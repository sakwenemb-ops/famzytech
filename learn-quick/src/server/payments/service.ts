import "server-only";
import type { Booking, Payment, User } from "@prisma/client";
import { db } from "@/lib/db";
import { cameroonOperator } from "@/lib/phone";
import { amountDue, confirmBooking } from "../booking";
import { getSetting } from "../settings";
import { notify } from "../notify";
import { ESCROW, EXTERNAL, LedgerError, balance, post } from "../ledger";
import { earnLesson } from "./lesson-money";
import { paymentProvider } from "./index";
import { ProviderError, type ProviderTransaction } from "./types";

export type PayError =
  | "not_found"
  | "expired"
  | "already_paid"
  | "phone_invalid"
  | "operator_unsupported"
  | "provider_unavailable"
  | "insufficient_wallet";

const MIN_CHECK_GAP_MS = 3000;

/** Mobile Money numbers we can charge: MTN or Orange Cameroon. */
export function payableOperator(phone: string) {
  const op = cameroonOperator(phone);
  return op === "MTN" || op === "ORANGE" ? op : null;
}

type HeldBooking = Booking & { teacher: { user: User } };

async function heldBookingFor(user: User, bookingId: string): Promise<{ b: HeldBooking } | { error: PayError }> {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { student: true, teacher: { include: { user: true } } } });
  if (!b || b.student.userId !== user.id) return { error: "not_found" };
  if (b.status === "CONFIRMED") return { error: "already_paid" };
  if (b.status !== "HELD" || !b.holdExpiresAt || b.holdExpiresAt <= new Date()) return { error: "expired" };
  return { b };
}

/**
 * Start a Mobile Money payment for a held booking: the student gets a prompt on their phone.
 * A payment already waiting for approval is reused, so a double click never charges twice.
 */
export async function startPayment(user: User, bookingId: string, phone: string): Promise<{ payment: Payment } | { error: PayError }> {
  const held = await heldBookingFor(user, bookingId);
  if ("error" in held) return held;
  const { b } = held;
  const operator = payableOperator(phone);
  if (!operator) return { error: cameroonOperator(phone) === "UNKNOWN" ? "phone_invalid" : "operator_unsupported" };

  const now = new Date();
  const pending = await db.payment.findFirst({ where: { bookingId: b.id, status: "PENDING", expiresAt: { gt: now } } });
  if (pending) return { payment: pending };

  const timeoutMin = await getSetting("paymentTimeoutMinutes");
  const expiresAt = new Date(now.getTime() + timeoutMin * 60_000);
  const amount = amountDue(b);
  const attempt = await db.payment.count({ where: { bookingId: b.id } });
  const payment = await db.payment.create({
    data: {
      userId: user.id,
      provider: "AGGREGATOR", // Campay (or the sandbox) handles both MTN and Orange
      phone,
      amountXaf: amount,
      bookingId: b.id,
      operator,
      idempotencyKey: `booking:${b.id}:${attempt + 1}`,
      expiresAt,
    },
  });
  // Keep the time slot reserved while the student approves on their phone
  const holdUntil = new Date(expiresAt.getTime() + 2 * 60_000);
  if (b.holdExpiresAt! < holdUntil) await db.booking.update({ where: { id: b.id }, data: { holdExpiresAt: holdUntil } });

  try {
    const res = await paymentProvider().requestPayment({
      amountXaf: amount,
      phone,
      description: `Learn Quick: ${b.teacher.user.name}`,
      externalRef: payment.id,
    });
    const updated = await db.payment.update({
      where: { id: payment.id },
      data: { providerRef: res.providerRef, ussdCode: res.ussdCode, operator: res.operator ?? operator, lastCheckedAt: new Date() },
    });
    await db.booking.update({ where: { id: b.id }, data: { paymentId: updated.id } });
    return { payment: updated };
  } catch (e) {
    console.error("Payment request failed", e);
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: (e as Error).message.slice(0, 300) } });
    return { error: "provider_unavailable" };
  }
}

/** Pay a held booking from the student's wallet (refunds), when the balance is enough. */
export async function payWithWallet(user: User, bookingId: string): Promise<{ ok: true } | { error: PayError }> {
  const held = await heldBookingFor(user, bookingId);
  if ("error" in held) return held;
  const { b } = held;
  const amount = amountDue(b);
  if ((await balance({ type: "STUDENT_WALLET", userId: user.id })) < amount) return { error: "insufficient_wallet" };

  const payment = await db.payment.create({
    data: { userId: user.id, provider: "WALLET", amountXaf: amount, bookingId: b.id, status: "PENDING", idempotencyKey: `wallet:${b.id}`, expiresAt: new Date(Date.now() + 60_000) },
  });
  try {
    await db.$transaction(async (tx) => {
      await post(tx, { kind: "WALLET_PAYMENT", referenceId: payment.id, lines: [{ account: { type: "STUDENT_WALLET", userId: user.id }, amount: -amount }, { account: ESCROW, amount }] });
      await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCESSFUL", confirmedAt: new Date() } });
      await tx.booking.update({ where: { id: b.id }, data: { paymentId: payment.id } });
    });
  } catch (e) {
    if (e instanceof LedgerError) {
      await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: "insufficient_wallet" } });
      return { error: "insufficient_wallet" };
    }
    throw e;
  }
  await settleBooking(payment.id);
  return { ok: true };
}

/**
 * Ask the provider for the true status of a pending payment and act on it.
 * Called by the checkout page (every few seconds), the webhook and the background job.
 */
export async function refreshPayment(paymentId: string, opts: { force?: boolean } = {}) {
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.status !== "PENDING" || !p.providerRef || p.provider === "WALLET") return p;
  if (!opts.force && p.lastCheckedAt && Date.now() - p.lastCheckedAt.getTime() < MIN_CHECK_GAP_MS) return p;
  await db.payment.update({ where: { id: p.id }, data: { lastCheckedAt: new Date() } });

  let tx: ProviderTransaction;
  try {
    tx = await paymentProvider().getStatus(p.providerRef);
  } catch (e) {
    if (e instanceof ProviderError) return p; // try again on the next check
    throw e;
  }
  if (tx.status === "PENDING") {
    // The payer never approved: give up after the timeout
    if (p.expiresAt < new Date()) {
      await db.payment.updateMany({ where: { id: p.id, status: "PENDING" }, data: { status: "EXPIRED" } });
    }
  } else {
    await finalizePayment(p.id, tx);
  }
  return db.payment.findUnique({ where: { id: p.id } });
}

/**
 * Record the provider's final answer exactly once. The status change is a compare-and-set
 * (PENDING → SUCCESSFUL), so a webhook, the checkout page and the job can all call this safely.
 */
export async function finalizePayment(paymentId: string, tx: ProviderTransaction) {
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (tx.status === "FAILED") {
    await db.payment.updateMany({ where: { id: p.id, status: { in: ["PENDING", "EXPIRED"] } }, data: { status: "FAILED", failureReason: "declined" } });
    return;
  }
  if (tx.status !== "SUCCESSFUL") return;

  const paid = tx.amountXaf ?? p.amountXaf;
  const won = await db.$transaction(async (t) => {
    // An approval that arrives after we marked the payment expired still counts: the money was taken
    const claimed = await t.payment.updateMany({
      where: { id: p.id, status: { in: ["PENDING", "EXPIRED", "FAILED"] } },
      data: { status: "SUCCESSFUL", confirmedAt: new Date(), providerPayload: { operatorRef: tx.operatorRef, operator: tx.operator, amount: paid } },
    });
    if (!claimed.count) return false;
    await post(t, { kind: "PAYMENT_IN", referenceId: p.id, memo: tx.operatorRef ?? undefined, lines: [{ account: EXTERNAL, amount: -paid }, { account: ESCROW, amount: paid }] });
    return true;
  });
  if (!won) return;

  if (tx.currency && tx.currency !== "XAF") {
    await refundToWallet(p, paid, "currency_mismatch");
    return;
  }
  if (paid !== p.amountXaf) {
    // Paid a different amount than asked: never confirm on a short payment; the money goes to the wallet
    await refundToWallet(p, paid, "amount_mismatch");
    return;
  }
  await settleBooking(p.id);
}

/** Confirm the booking a payment was for; if the slot is gone, the money goes to the student's wallet. */
async function settleBooking(paymentId: string) {
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (!p.bookingId) return;
  const b = await db.booking.findUniqueOrThrow({ where: { id: p.bookingId } });
  if (b.status === "CONFIRMED") return;

  // A late approval: put the hold back for a moment so it can be confirmed, if the time is still free
  if (b.status === "EXPIRED" || (b.holdExpiresAt && b.holdExpiresAt <= new Date())) {
    try {
      await db.booking.update({ where: { id: b.id }, data: { status: "HELD", holdExpiresAt: new Date(Date.now() + 60_000) } });
    } catch {
      await refundToWallet(p, p.amountXaf, "slot_taken");
      return;
    }
  }
  await db.booking.update({ where: { id: b.id }, data: { paymentId: p.id } });
  const res = await confirmBooking(b.id);
  if ("error" in res) {
    await refundToWallet(p, p.amountXaf, "slot_taken");
    return;
  }
  // A pack bought with this payment points to it, for refunds and receipts
  const confirmed = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
  if (confirmed.packageId && confirmed.packageSize) {
    await db.lessonPackage.updateMany({ where: { id: confirmed.packageId, paymentId: null }, data: { paymentId: p.id } });
  }
}

async function refundToWallet(p: Payment, amount: number, reason: string) {
  await db.$transaction(async (t) => {
    await post(t, { kind: "UNBOOKED_REFUND", referenceId: p.id, memo: reason, lines: [{ account: ESCROW, amount: -amount }, { account: { type: "STUDENT_WALLET", userId: p.userId }, amount }] });
    await t.auditLog.create({ data: { action: "PAYMENT_TO_WALLET", targetType: "Payment", targetId: p.id, meta: { reason, amount } } });
  });
  await notify(p.userId, {
    type: "PAYMENT_TO_WALLET",
    title: { en: "Payment added to your wallet", fr: "Paiement ajouté à votre portefeuille" },
    body: {
      en: `We received ${amount} FCFA but could not book the lesson (the time is no longer free). The money is in your wallet: use it for another lesson or withdraw it.`,
      fr: `Nous avons reçu ${amount} FCFA mais n'avons pas pu réserver le cours (le créneau n'est plus libre). L'argent est dans votre portefeuille : utilisez-le pour un autre cours ou retirez-le.`,
    },
    link: "/student/wallet",
  });
}

/**
 * Background job. Lessons that ended become COMPLETED and their price moves to the teacher's
 * pending earnings; 24 hours later (no dispute) it becomes available to withdraw.
 * Phase 6 adds attendance, so a no-show is handled differently.
 */
export async function settleLessons(now = new Date()) {
  const releaseH = await getSetting("escrowReleaseHours");
  const ended = await db.booking.findMany({ where: { status: "CONFIRMED", endsAt: { lte: now } }, include: { teacher: true } });
  for (const b of ended) {
    const claimed = await db.booking.updateMany({
      where: { id: b.id, status: "CONFIRMED" },
      data: { status: "COMPLETED", releaseAt: new Date(b.endsAt.getTime() + releaseH * 3_600_000) },
    });
    if (!claimed.count) continue;
    await db.teacherProfile.update({ where: { id: b.teacherId }, data: { lessonsCompleted: { increment: 1 } } });
    await earnLesson(b, b.teacher.userId);
  }

  // Release pending earnings whose dispute window has passed. Late cancellations
  // (status CANCELLED_BY_STUDENT with LESSON_EARNED posted) are released the same way.
  const due = await db.booking.findMany({
    where: { releaseAt: { lte: now }, status: { in: ["COMPLETED", "CANCELLED_BY_STUDENT"] }, dispute: null },
    include: { teacher: true },
  });
  let released = 0;
  for (const b of due) {
    const earned = await db.ledgerTransaction.findUnique({ where: { kind_referenceId: { kind: "LESSON_EARNED", referenceId: b.id } }, include: { lines: { include: { account: true } } } });
    const net = earned?.lines.find((l) => l.account.type === "TEACHER_PENDING")?.amountXaf;
    if (!net) continue;
    const posted = await db.$transaction((t) =>
      post(t, {
        kind: "EARNINGS_RELEASED",
        referenceId: b.id,
        lines: [{ account: { type: "TEACHER_PENDING", userId: b.teacher.userId }, amount: -net }, { account: { type: "TEACHER_AVAILABLE", userId: b.teacher.userId }, amount: net }],
      }),
    );
    if (posted) released++;
  }
  return { completed: ended.length, released };
}

/** Background job: re-check payments still waiting (in case a webhook was lost) and expire old ones. */
export async function checkPendingPayments(now = new Date()) {
  const pending = await db.payment.findMany({
    where: { status: "PENDING", provider: { not: "WALLET" }, createdAt: { lte: new Date(now.getTime() - 20_000) } },
    take: 200,
  });
  for (const p of pending) await refreshPayment(p.id, { force: true });
  // Payments expired by us in the last 24 hours are checked once more: a late approval still counts
  const recent = await db.payment.findMany({ where: { status: "EXPIRED", provider: { not: "WALLET" }, expiresAt: { gte: new Date(now.getTime() - 86_400_000) } }, take: 200 });
  for (const p of recent) {
    if (!p.providerRef) continue;
    try {
      const tx = await paymentProvider().getStatus(p.providerRef);
      if (tx.status !== "PENDING") await finalizePayment(p.id, tx);
    } catch {}
  }
  return pending.length;
}

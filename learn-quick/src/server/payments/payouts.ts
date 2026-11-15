import "server-only";
import type { LedgerAccountType, Payout, User } from "@prisma/client";
import { db } from "@/lib/db";
import { cameroonOperator } from "@/lib/phone";
import { EXTERNAL, IN_FLIGHT, LedgerError, balance, post } from "../ledger";
import { getSetting } from "../settings";
import { notify } from "../notify";
import { paymentProvider } from "./index";
import { payableOperator } from "./service";
import { ProviderError } from "./types";

export type PayoutError = "amount_invalid" | "below_minimum" | "insufficient" | "phone_invalid" | "operator_unsupported" | "not_found" | "not_allowed";

/** Where a person's withdrawable money is: teachers withdraw earnings, students their wallet. */
export const payoutSource = (role: User["role"]): LedgerAccountType | null =>
  role === "TEACHER" ? "TEACHER_AVAILABLE" : role === "STUDENT" ? "STUDENT_WALLET" : null;

/**
 * Ask to withdraw money to a Mobile Money number. The amount is set aside at once
 * (so it can't be spent twice); it goes out after admin approval, or straight away if
 * approval is switched off.
 */
export async function requestPayout(user: User, amountXaf: number, phone: string): Promise<{ payout: Payout } | { error: PayoutError }> {
  const source = payoutSource(user.role);
  if (!source) return { error: "not_allowed" };
  if (!Number.isInteger(amountXaf) || amountXaf <= 0) return { error: "amount_invalid" };
  // Students can withdraw any wallet amount; teachers have a minimum to keep transfer fees sensible
  if (source === "TEACHER_AVAILABLE" && amountXaf < (await getSetting("minPayoutXaf"))) return { error: "below_minimum" };
  const operator = payableOperator(phone);
  if (!operator) return { error: cameroonOperator(phone) === "UNKNOWN" ? "phone_invalid" : "operator_unsupported" };
  if ((await balance({ type: source, userId: user.id })) < amountXaf) return { error: "insufficient" };

  const teacher = source === "TEACHER_AVAILABLE" ? await db.teacherProfile.findUnique({ where: { userId: user.id } }) : null;
  let payout: Payout;
  try {
    payout = await db.$transaction(async (t) => {
      const p = await t.payout.create({
        data: { userId: user.id, source, teacherId: teacher?.id, amountXaf, phone, provider: "AGGREGATOR" },
      });
      await post(t, { kind: "PAYOUT_RESERVED", referenceId: p.id, lines: [{ account: { type: source, userId: user.id }, amount: -amountXaf }, { account: IN_FLIGHT, amount: amountXaf }] });
      await t.auditLog.create({ data: { actorId: user.id, action: "PAYOUT_REQUESTED", targetType: "Payout", targetId: p.id, meta: { amountXaf, operator } } });
      return p;
    });
  } catch (e) {
    if (e instanceof LedgerError) return { error: "insufficient" };
    throw e;
  }
  if (teacher) await db.teacherProfile.update({ where: { id: teacher.id }, data: { payoutPhone: phone, payoutProvider: "AGGREGATOR" } });
  if (!(await getSetting("payoutRequiresApproval"))) await sendPayout(payout.id, null);
  return { payout: (await db.payout.findUnique({ where: { id: payout.id } }))! };
}

/** Admin approval: send the money now. */
export async function approvePayout(admin: User, payoutId: string) {
  const claimed = await db.payout.updateMany({ where: { id: payoutId, status: "REQUESTED" }, data: { status: "APPROVED", approvedBy: admin.id } });
  if (!claimed.count) return { error: "not_allowed" as const };
  await db.auditLog.create({ data: { actorId: admin.id, action: "PAYOUT_APPROVED", targetType: "Payout", targetId: payoutId } });
  await sendPayout(payoutId, admin.id);
  return { ok: true as const };
}

export async function rejectPayout(admin: User, payoutId: string, reason: string) {
  const claimed = await db.payout.updateMany({ where: { id: payoutId, status: "REQUESTED" }, data: { status: "REJECTED", failureReason: reason.slice(0, 300), approvedBy: admin.id } });
  if (!claimed.count) return { error: "not_allowed" as const };
  await returnFunds(payoutId);
  await db.auditLog.create({ data: { actorId: admin.id, action: "PAYOUT_REJECTED", targetType: "Payout", targetId: payoutId, meta: { reason } } });
  return { ok: true as const };
}

async function sendPayout(payoutId: string, adminId: string | null) {
  const p = await db.payout.findUniqueOrThrow({ where: { id: payoutId } });
  if (p.status !== "REQUESTED" && p.status !== "APPROVED") return;
  await db.payout.update({ where: { id: p.id }, data: { status: "PROCESSING", approvedBy: p.approvedBy ?? adminId } });
  try {
    const res = await paymentProvider().disburse({ amountXaf: p.amountXaf, phone: p.phone, description: "Learn Quick payout", externalRef: p.id });
    await db.payout.update({ where: { id: p.id }, data: { providerRef: res.providerRef } });
    if (res.status !== "PENDING") await finishPayout(p.id, res.status);
  } catch (e) {
    console.error("Payout failed", e);
    await finishPayout(p.id, "FAILED", e instanceof ProviderError ? e.message : "error");
  }
}

/** Record the final result of a payout exactly once. */
async function finishPayout(payoutId: string, status: "SUCCESSFUL" | "FAILED", reason?: string) {
  const p = await db.payout.findUniqueOrThrow({ where: { id: payoutId } });
  if (status === "SUCCESSFUL") {
    const claimed = await db.payout.updateMany({ where: { id: p.id, status: "PROCESSING" }, data: { status: "PAID" } });
    if (!claimed.count) return;
    await db.$transaction((t) => post(t, { kind: "PAYOUT_SENT", referenceId: p.id, lines: [{ account: IN_FLIGHT, amount: -p.amountXaf }, { account: EXTERNAL, amount: p.amountXaf }] }));
    await notify(p.userId, {
      type: "PAYOUT_PAID",
      title: { en: "Money sent", fr: "Argent envoyé" },
      body: { en: `${p.amountXaf} FCFA has been sent to ${p.phone}.`, fr: `${p.amountXaf} FCFA ont été envoyés au ${p.phone}.` },
    });
  } else {
    const claimed = await db.payout.updateMany({ where: { id: p.id, status: { in: ["PROCESSING", "APPROVED"] } }, data: { status: "FAILED", failureReason: reason?.slice(0, 300) } });
    if (!claimed.count) return;
    await returnFunds(p.id);
    await notify(p.userId, {
      type: "PAYOUT_FAILED",
      title: { en: "Transfer failed", fr: "Échec du transfert" },
      body: { en: "We could not send your money. It is back in your balance; please check the number and try again.", fr: "Nous n'avons pas pu envoyer votre argent. Il est de nouveau sur votre solde ; vérifiez le numéro et réessayez." },
    });
  }
}

async function returnFunds(payoutId: string) {
  const p = await db.payout.findUniqueOrThrow({ where: { id: payoutId } });
  await db.$transaction((t) =>
    post(t, { kind: "PAYOUT_RETURNED", referenceId: p.id, lines: [{ account: IN_FLIGHT, amount: -p.amountXaf }, { account: { type: p.source, userId: p.userId }, amount: p.amountXaf }] }),
  );
}

/** Background job: ask the provider about payouts still in progress. */
export async function checkPayouts() {
  const processing = await db.payout.findMany({ where: { status: "PROCESSING", providerRef: { not: null } }, take: 100 });
  for (const p of processing) {
    try {
      const tx = await paymentProvider().getStatus(p.providerRef!);
      if (tx.status !== "PENDING") await finishPayout(p.id, tx.status);
    } catch {}
  }
  return processing.length;
}

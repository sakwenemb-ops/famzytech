"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { assertRole } from "./session";
import { paymentProvider } from "./payments";
import { payWithWallet, refreshPayment, startPayment } from "./payments/service";
import { approvePayout, rejectPayout, requestPayout } from "./payments/payouts";
import type { FormState } from "./auth-actions";

export async function startPaymentAction(bookingId: string, rawPhone: string) {
  const user = await assertRole("STUDENT");
  const phone = normalizePhone(rawPhone);
  if (!phone) return { error: "phone_invalid" as const };
  const res = await startPayment(user, bookingId, phone);
  if ("error" in res) return res;
  return { paymentId: res.payment.id, ussdCode: res.payment.ussdCode, operator: res.payment.operator, expiresAt: res.payment.expiresAt.toISOString() };
}

/** Polled by the checkout page every few seconds. */
export async function paymentStatusAction(paymentId: string) {
  const user = await assertRole("STUDENT");
  const own = await db.payment.findUnique({ where: { id: paymentId } });
  if (!own || own.userId !== user.id) return { status: "NOT_FOUND" as const };
  const p = await refreshPayment(paymentId);
  const booking = p?.bookingId ? await db.booking.findUnique({ where: { id: p.bookingId }, select: { status: true, id: true } }) : null;
  return { status: p!.status, bookingConfirmed: booking?.status === "CONFIRMED", bookingId: booking?.id };
}

export async function payWithWalletAction(bookingId: string) {
  const user = await assertRole("STUDENT");
  return payWithWallet(user, bookingId);
}

/** Sandbox only: plays the payer approving or declining on their phone. */
export async function sandboxDecideAction(paymentId: string, decision: "approve" | "decline") {
  const user = await assertRole("STUDENT");
  if (paymentProvider().name !== "sandbox") throw new Error("FORBIDDEN");
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p || p.userId !== user.id) throw new Error("NOT_FOUND");
  await db.payment.update({ where: { id: p.id }, data: { providerPayload: { sandbox: decision === "approve" ? "SUCCESSFUL" : "FAILED" } } });
  await refreshPayment(p.id, { force: true });
}

export async function requestPayoutAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await assertRole("STUDENT", "TEACHER");
  const parsed = z
    .object({ amount: z.string().regex(/^\d{1,9}$/, "amount_invalid"), phone: z.string().min(6, "phone_invalid"), password: z.string().min(1, "current_password_wrong") })
    .safeParse({ amount: String(fd.get("amount") ?? "").replace(/\s/g, ""), phone: String(fd.get("phone") ?? ""), password: String(fd.get("password") ?? "") });
  if (!parsed.success) return { errors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };

  // Sending money out always needs the password, even when already logged in
  if (!user.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return { errors: { password: "current_password_wrong" } };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { errors: { phone: "phone_invalid" } };

  const res = await requestPayout(user, Number(parsed.data.amount), phone);
  if ("error" in res) return { errors: { [res.error === "phone_invalid" || res.error === "operator_unsupported" ? "phone" : "amount"]: `payout_${res.error}` } };
  revalidatePath("/[locale]", "layout");
  return { ok: true, message: res.payout.status === "PAID" ? "payout_sent" : "payout_requested" };
}

export async function approvePayoutAction(id: string) {
  const admin = await assertRole("ADMIN");
  const res = await approvePayout(admin, id);
  revalidatePath("/[locale]/admin/payments", "page");
  return res;
}

export async function rejectPayoutAction(id: string, reason: string) {
  const admin = await assertRole("ADMIN");
  const res = await rejectPayout(admin, id, reason || "rejected");
  revalidatePath("/[locale]/admin/payments", "page");
  return res;
}

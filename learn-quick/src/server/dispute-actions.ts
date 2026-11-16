"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "./session";
import { DisputeFailure, REFUND_CHOICES, openDispute, resolveDispute, respondToDispute } from "./disputes";

type State = { ok?: true; error?: string } | undefined;
const text = z.string().trim().min(10).max(2000);

async function run(fn: () => Promise<unknown>): Promise<State> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof DisputeFailure) return { error: e.code };
    throw e;
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

export async function openDisputeAction(bookingId: string, _: State, fd: FormData): Promise<State> {
  const user = await assertRole("STUDENT");
  const reason = text.safeParse(fd.get("reason"));
  if (!reason.success) return { error: "reason_short" };
  return run(() => openDispute(user, bookingId, reason.data));
}

export async function respondDisputeAction(disputeId: string, _: State, fd: FormData): Promise<State> {
  const user = await assertRole("TEACHER");
  const response = text.safeParse(fd.get("response"));
  if (!response.success) return { error: "reason_short" };
  return run(() => respondToDispute(user, disputeId, response.data));
}

export async function resolveDisputeAction(disputeId: string, _: State, fd: FormData): Promise<State> {
  const admin = await assertRole("ADMIN");
  const parsed = z
    .object({ refundPct: z.coerce.number().refine((n): n is (typeof REFUND_CHOICES)[number] => (REFUND_CHOICES as readonly number[]).includes(n)), note: text })
    .safeParse({ refundPct: fd.get("refundPct"), note: fd.get("note") });
  if (!parsed.success) return { error: parsed.error.issues[0].path[0] === "note" ? "reason_short" : "refund_required" };
  return run(() => resolveDispute(admin, disputeId, parsed.data.refundPct as (typeof REFUND_CHOICES)[number], parsed.data.note));
}

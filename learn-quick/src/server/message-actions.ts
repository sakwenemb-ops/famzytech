"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser, isVerified } from "./session";
import { MessagingFailure, MAX_MESSAGE, markRead, reportConversation, sendMessage, startConversation } from "./messaging";

async function participant() {
  const user = await getCurrentUser();
  if (!user || !isVerified(user) || (user.role !== "STUDENT" && user.role !== "TEACHER")) throw new Error("FORBIDDEN");
  return user;
}

export type MessageState = { error?: string; id?: string; at?: string; body?: string; redacted?: boolean } | undefined;

/** From a teacher profile or a lesson: open (or create) the conversation and go to it. */
export async function startConversationAction(otherUserId: string) {
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) return redirect({ href: "/login", locale });
  let id: string;
  try {
    id = (await startConversation(await participant(), otherUserId)).id;
  } catch (e) {
    if (e instanceof MessagingFailure) return redirect({ href: `/messages?error=${e.code}`, locale });
    throw e;
  }
  redirect({ href: `/messages/${id}`, locale });
}

export async function sendMessageAction(conversationId: string, _: MessageState, fd: FormData): Promise<MessageState> {
  const user = await participant();
  const body = z.string().max(MAX_MESSAGE + 100).safeParse(fd.get("body"));
  if (!body.success) return { error: "too_long" };
  try {
    const m = await sendMessage(user, conversationId, body.data);
    return { id: m.id, at: m.createdAt.toISOString(), body: m.body, redacted: m.redacted };
  } catch (e) {
    if (e instanceof MessagingFailure) return { error: e.code };
    throw e;
  }
}

export async function markReadAction(conversationId: string) {
  const user = await participant();
  return markRead(user, conversationId);
}

export async function reportConversationAction(conversationId: string, _: unknown, fd: FormData) {
  const user = await participant();
  const reason = z.string().trim().min(5).max(1000).safeParse(fd.get("reason"));
  if (!reason.success) return { error: "reason_required" as const };
  await reportConversation(user, conversationId, reason.data);
  return { ok: true as const };
}

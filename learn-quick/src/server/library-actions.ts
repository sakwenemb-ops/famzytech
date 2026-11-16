"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { LEVELS } from "@/lib/grading";
import { redirect } from "@/i18n/navigation";
import { assertRole } from "./session";
import { revealHint, saveAnswer, startExam, startPractice, submitAttempt } from "./library/service";
import { db } from "@/lib/db";

/** The library is free for students and teachers. */
const learner = () => assertRole("STUDENT", "TEACHER");

export async function startPracticeAction(fd: FormData) {
  const user = await learner();
  const p = z
    .object({ level: z.enum(LEVELS), direction: z.enum(["EN_FR", "FR_EN"]).optional(), topic: z.string().max(40).optional() })
    .parse({ level: fd.get("level"), direction: fd.get("direction") || undefined, topic: fd.get("topic") || undefined });
  const attempt = await startPractice(user, p);
  const locale = await getLocale();
  if (!attempt) redirect({ href: "/library?empty=1", locale });
  redirect({ href: `/library/attempt/${attempt!.id}`, locale });
}

export async function startExamAction(level: string) {
  const user = await learner();
  const attempt = await startExam(user, z.enum(LEVELS).parse(level));
  if (!attempt) throw new Error("NOT_FOUND");
  redirect({ href: `/library/attempt/${attempt.id}`, locale: await getLocale() });
}

export async function saveAnswerAction(attemptId: string, itemId: string, value: { answerText?: string; choiceIndex?: number }) {
  const user = await learner();
  return saveAnswer(user, attemptId, itemId, {
    answerText: typeof value.answerText === "string" ? value.answerText : undefined,
    choiceIndex: Number.isInteger(value.choiceIndex) ? value.choiceIndex : undefined,
  });
}

export async function hintAction(attemptId: string, itemId: string) {
  const user = await learner();
  return revealHint(user, attemptId, itemId);
}

export async function submitAttemptAction(attemptId: string) {
  const user = await learner();
  await submitAttempt(user, attemptId);
  redirect({ href: `/library/results/${attemptId}`, locale: await getLocale() });
}

/** Polled by the results page while grading runs. */
export async function attemptStatusAction(attemptId: string) {
  const user = await learner();
  const a = await db.testAttempt.findUnique({ where: { id: attemptId }, select: { userId: true, status: true } });
  return a?.userId === user.id ? a.status : null;
}

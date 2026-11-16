import "server-only";
import { randomBytes } from "node:crypto";
import type { CefrLevel, Exercise, Prisma, TestAnswer, TranslationDirection, User } from "@prisma/client";
import { db } from "@/lib/db";
import { LEVELS, attemptPercent, estimateLevel, gradeGap, similarityScore, withHint } from "@/lib/grading";
import { getSetting } from "../settings";
import { GradingUnavailable, aiGradingEnabled, gradeWithClaude } from "./claude-grader";

export const PRACTICE_SIZE = 5;
const GRACE_MS = 30_000; // answers saved up to 30 s after an exam's time is up (slow networks)
const MAX_AI_RETRIES = 3;

/** How an answer was graded. */
export type GradedBy = "auto" | "claude" | "basic" | "basic-retry";
export type AnswerError = { excerpt: string; type: string; explanation: string; suggestion: string };

const attemptInclude = {
  test: { include: { items: { orderBy: { position: "asc" }, include: { exercise: true } } } },
  answers: true,
} satisfies Prisma.TestAttemptInclude;
export type FullAttempt = Prisma.TestAttemptGetPayload<{ include: typeof attemptInclude }>;

export async function getAttempt(user: User, attemptId: string) {
  const a = await db.testAttempt.findUnique({ where: { id: attemptId }, include: attemptInclude });
  return a && (a.userId === user.id || user.role === "ADMIN") ? a : null;
}

/** A short practice: up to 5 random published exercises of one level (and direction / topic if chosen). */
export async function startPractice(user: User, f: { level: CefrLevel; direction?: TranslationDirection; topic?: string }) {
  const pool = await db.exercise.findMany({
    where: { status: "PUBLISHED", level: f.level, direction: f.direction, topic: f.topic },
    select: { id: true },
  });
  if (!pool.length) return null;
  const picked = pool.sort(() => Math.random() - 0.5).slice(0, PRACTICE_SIZE);
  const test = await db.test.create({
    data: {
      title: "practice",
      level: f.level,
      direction: f.direction,
      isRandom: true,
      status: "PUBLISHED",
      items: { create: picked.map((p, i) => ({ exerciseId: p.id, position: i + 1, points: 10 })) },
    },
  });
  return db.testAttempt.create({ data: { testId: test.id, userId: user.id } });
}

/** A timed exam for a level: 10 exercises, 30 minutes. */
export async function startExam(user: User, level: CefrLevel) {
  const test = await db.test.findFirst({ where: { title: `exam:${level}`, status: "PUBLISHED" } });
  if (!test) return null;
  // An exam already in progress is resumed rather than restarted
  const open = await db.testAttempt.findFirst({ where: { testId: test.id, userId: user.id, status: "IN_PROGRESS", deadlineAt: { gt: new Date() } } });
  if (open) return open;
  return db.testAttempt.create({
    data: { testId: test.id, userId: user.id, deadlineAt: new Date(Date.now() + (test.timeLimitMin ?? 30) * 60_000) },
  });
}

function editable(a: { status: string; deadlineAt: Date | null }) {
  return a.status === "IN_PROGRESS" && (!a.deadlineAt || a.deadlineAt.getTime() + GRACE_MS > Date.now());
}

/** Autosave one answer. */
export async function saveAnswer(user: User, attemptId: string, itemId: string, value: { answerText?: string; choiceIndex?: number }) {
  const a = await db.testAttempt.findUnique({ where: { id: attemptId }, include: { test: { include: { items: true } } } });
  if (!a || a.userId !== user.id || !editable(a) || !a.test.items.some((i) => i.id === itemId)) return false;
  await db.testAnswer.upsert({
    where: { attemptId_itemId: { attemptId, itemId } },
    create: { attemptId, itemId, answerText: value.answerText?.slice(0, 4000), choiceIndex: value.choiceIndex, autosavedAt: new Date() },
    update: { answerText: value.answerText?.slice(0, 4000), choiceIndex: value.choiceIndex, autosavedAt: new Date() },
  });
  return true;
}

/** Show the key vocabulary for an item. It lowers the best possible score for that item by 20%. */
export async function revealHint(user: User, attemptId: string, itemId: string) {
  const a = await db.testAttempt.findUnique({ where: { id: attemptId }, include: { test: { include: { items: { include: { exercise: true } } } } } });
  const item = a?.test.items.find((i) => i.id === itemId);
  if (!a || a.userId !== user.id || !editable(a) || !item) return null;
  await db.testAnswer.upsert({ where: { attemptId_itemId: { attemptId, itemId } }, create: { attemptId, itemId, hintUsed: true }, update: { hintUsed: true } });
  return (item.exercise.keyVocabulary ?? []) as { source: string; target: string }[];
}

export async function submitAttempt(user: User, attemptId: string) {
  const claimed = await db.testAttempt.updateMany({
    where: { id: attemptId, userId: user.id, status: "IN_PROGRESS" },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  if (!claimed.count) return false;
  // Grade in the background; the results page shows progress. The library job retries if needed.
  void gradeAttempt(attemptId).catch((e) => console.error("Grading failed", e));
  return true;
}

/** How many AI-graded answers this person had in the last 24 hours (fair-use limit). */
async function aiGradesToday(userId: string) {
  return db.testAnswer.count({
    where: { gradedBy: "claude", attempt: { userId, submittedAt: { gte: new Date(Date.now() - 86_400_000) } } },
  });
}

type ItemGrade = Pick<TestAnswer, "scorePct" | "accuracy" | "grammar" | "vocabulary" | "style" | "correctedText" | "feedback"> & {
  errors: AnswerError[] | null;
  gradedBy: GradedBy;
  estimatedLevel?: string | null;
};

const empty = (gradedBy: GradedBy, score = 0): ItemGrade => ({
  scorePct: score, accuracy: null, grammar: null, vocabulary: null, style: null, correctedText: null, feedback: null, errors: null, gradedBy,
});

async function gradeItem(ex: Exercise, answer: TestAnswer | undefined, user: User, allowAi: boolean): Promise<ItemGrade> {
  const text = answer?.answerText?.trim() ?? "";
  if (ex.type === "MULTIPLE_CHOICE") {
    const options = (ex.options ?? []) as { text: string; correct: boolean }[];
    return empty("auto", answer?.choiceIndex != null && options[answer.choiceIndex]?.correct ? 100 : 0);
  }
  if (ex.type === "FILL_GAP") {
    const g = gradeGap(text, ex.references);
    return { ...empty("auto", g.score), feedback: g.accentOnly ? "accent" : null };
  }
  if (!text) return empty("auto", 0);
  const basic = (gradedBy: GradedBy): ItemGrade => ({ ...empty(gradedBy, similarityScore(text, ex.references)), correctedText: ex.references[0] });
  if (!allowAi) return basic("basic");
  try {
    const g = await gradeWithClaude({ direction: ex.direction, level: ex.level, source: ex.sourceText, references: ex.references, answer: text, feedbackLanguage: user.locale });
    return {
      scorePct: g.score,
      accuracy: g.accuracy,
      grammar: g.grammar,
      vocabulary: g.vocabulary,
      style: g.style,
      correctedText: g.correctedText,
      feedback: g.feedback,
      errors: g.errors,
      gradedBy: "claude",
      estimatedLevel: g.estimatedLevel,
    };
  } catch (e) {
    if (!(e instanceof GradingUnavailable)) console.error("AI grading error", e);
    // Show an instant basic score now; the AI correction is retried later
    return basic("basic-retry");
  }
}

/** Run tasks a few at a time. */
async function inBatches<T>(tasks: (() => Promise<T>)[], size = 3) {
  const out: T[] = [];
  for (let i = 0; i < tasks.length; i += size) out.push(...(await Promise.all(tasks.slice(i, i + size).map((t) => t()))));
  return out;
}

/**
 * Grade every answer of a submitted attempt (or only those waiting for an AI retry).
 * Multiple choice and fill-the-gap are scored here; translations by Claude, within the
 * daily fair-use limit, else by similarity to the reference translations.
 */
export async function gradeAttempt(attemptId: string, opts: { retryOnly?: boolean } = {}) {
  const a = await db.testAttempt.findUnique({ where: { id: attemptId }, include: { ...attemptInclude, user: true } });
  if (!a || !["SUBMITTED", "PENDING_REVIEW"].includes(a.status)) return;
  const limit = await getSetting("libraryAiGradesPerDay");
  let aiBudget = aiGradingEnabled() ? Math.max(0, limit - (await aiGradesToday(a.userId))) : 0;

  const tasks = a.test.items.map((item) => async () => {
    const answer = a.answers.find((x) => x.itemId === item.id);
    if (opts.retryOnly && answer?.gradedBy !== "basic-retry") return null;
    const freeText = item.exercise.type === "SENTENCE" || item.exercise.type === "PARAGRAPH";
    const useAi = freeText && Boolean(answer?.answerText?.trim()) && aiBudget > 0;
    if (useAi) aiBudget--;
    const g = await gradeItem(item.exercise, answer, a.user, useAi);
    const score = withHint(g.scorePct ?? 0, answer?.hintUsed ?? false);
    const data = {
      scorePct: score,
      accuracy: g.accuracy,
      grammar: g.grammar,
      vocabulary: g.vocabulary,
      style: g.style,
      correctedText: g.correctedText,
      feedback: g.feedback,
      errors: g.errors ?? undefined,
      gradedBy: g.gradedBy,
      gradeAttempts: { increment: g.gradedBy === "basic-retry" ? 1 : 0 },
    };
    await db.testAnswer.upsert({ where: { attemptId_itemId: { attemptId, itemId: item.id } }, create: { attemptId, itemId: item.id, ...data, gradeAttempts: g.gradedBy === "basic-retry" ? 1 : 0 }, update: data });
    return g;
  });
  await inBatches(tasks);

  const answers = await db.testAnswer.findMany({ where: { attemptId } });
  const percent = attemptPercent(a.test.items.map((i) => ({ score: answers.find((x) => x.itemId === i.id)?.scorePct ?? 0, points: i.points })));
  const waiting = answers.some((x) => x.gradedBy === "basic-retry" && x.gradeAttempts < MAX_AI_RETRIES);
  const passed = a.test.isTimedExam ? percent >= a.test.passMark : null;
  await db.testAttempt.update({
    where: { id: attemptId },
    data: {
      status: waiting ? "PENDING_REVIEW" : "GRADED",
      scorePct: percent,
      estimatedLevel: estimateLevel(a.test.level as (typeof LEVELS)[number], percent),
      passed,
      certificateNo: passed && !a.certificateNo ? `LQ-${a.test.level}-${randomBytes(4).toString("hex").toUpperCase()}` : undefined,
    },
  });
}

/** Background job: finish attempts whose grading was interrupted, and retry AI grading that failed. */
export async function retryGrading() {
  const stale = await db.testAttempt.findMany({
    where: { OR: [{ status: "PENDING_REVIEW" }, { status: "SUBMITTED", submittedAt: { lte: new Date(Date.now() - 120_000) } }] },
    select: { id: true, status: true },
    take: 50,
  });
  for (const s of stale) await gradeAttempt(s.id, { retryOnly: s.status === "PENDING_REVIEW" });
  // Exams left open after the time ran out are submitted automatically
  const expired = await db.testAttempt.findMany({ where: { status: "IN_PROGRESS", deadlineAt: { lte: new Date(Date.now() - GRACE_MS) } }, select: { id: true } });
  for (const e of expired) {
    await db.testAttempt.update({ where: { id: e.id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
    await gradeAttempt(e.id);
  }
  return stale.length + expired.length;
}

/** Progress for the history page. */
export async function progress(userId: string) {
  const attempts = await db.testAttempt.findMany({
    where: { userId, status: { in: ["GRADED", "PENDING_REVIEW", "REVIEWED"] } },
    orderBy: { submittedAt: "asc" },
    include: { test: true, answers: { select: { errors: true } } },
  });
  const byDirection: Record<string, { sum: number; n: number }> = {};
  const errorTypes: Record<string, number> = {};
  for (const a of attempts) {
    const dirs = a.test.direction ? [a.test.direction] : ["EN_FR", "FR_EN"];
    for (const d of dirs) {
      byDirection[d] ??= { sum: 0, n: 0 };
      byDirection[d].sum += a.scorePct ?? 0;
      byDirection[d].n++;
    }
    for (const ans of a.answers) for (const e of (ans.errors ?? []) as AnswerError[]) errorTypes[e.type] = (errorTypes[e.type] ?? 0) + 1;
  }
  // Suggest the next level: up after strong results at a level, down after weak ones
  const last = attempts.slice(-3);
  let suggestion: { level: string; why: "up" | "same" | "down" } | null = null;
  if (last.length) {
    const lvl = last[last.length - 1].test.level as (typeof LEVELS)[number];
    const avg = last.filter((x) => x.test.level === lvl).reduce((s, x, _, arr) => s + (x.scorePct ?? 0) / arr.length, 0);
    const i = LEVELS.indexOf(lvl);
    suggestion = avg >= 80 && i < 5 ? { level: LEVELS[i + 1], why: "up" } : avg < 50 && i > 0 ? { level: LEVELS[i - 1], why: "down" } : { level: lvl, why: "same" };
  }
  return { attempts, byDirection, errorTypes, suggestion };
}

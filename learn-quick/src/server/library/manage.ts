import "server-only";
import { z } from "zod";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { LEVELS } from "@/lib/grading";

const TOPICS = ["DAILY_LIFE", "TRAVEL", "HEALTH", "BUSINESS", "LAW", "TECH", "NEWS", "ACADEMIC", "LITERATURE"] as const;

/** One exercise, as typed in the form or given in a JSON import. */
export const exerciseInput = z
  .object({
    code: z.string().trim().regex(/^[a-z0-9-]{3,40}$/, "code_invalid").optional(),
    type: z.enum(["SENTENCE", "PARAGRAPH", "FILL_GAP", "MULTIPLE_CHOICE"]),
    direction: z.enum(["EN_FR", "FR_EN"]),
    level: z.enum(LEVELS),
    topic: z.enum(TOPICS),
    sourceText: z.string().trim().min(2, "required").max(3000),
    references: z.array(z.string().trim().min(1).max(3000)).min(1, "references_required").max(10),
    gapTemplate: z.string().trim().max(1000).optional(),
    options: z.array(z.object({ text: z.string().trim().min(1).max(500), correct: z.boolean() })).optional(),
    keyVocabulary: z.array(z.object({ source: z.string().trim().min(1).max(100), target: z.string().trim().min(1).max(100) })).max(12).optional(),
    commonMistakes: z.string().trim().max(1000).optional(),
  })
  .superRefine((e, ctx) => {
    if (e.type === "FILL_GAP" && (e.gapTemplate?.split("___").length ?? 0) !== 2) ctx.addIssue({ code: "custom", path: ["gapTemplate"], message: "gap_invalid" });
    if (e.type === "MULTIPLE_CHOICE" && ((e.options?.length ?? 0) < 2 || e.options!.filter((o) => o.correct).length !== 1)) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "options_invalid" });
    }
  });
export type ExerciseInput = z.infer<typeof exerciseInput>;

/** Admins manage everything; approved teachers write drafts (an admin publishes them). */
export async function canManage(user: User) {
  if (user.role === "ADMIN") return "admin" as const;
  if (user.role !== "TEACHER") return null;
  const t = await db.teacherProfile.findUnique({ where: { userId: user.id }, select: { isPublished: true } });
  return t?.isPublished ? ("teacher" as const) : null;
}

/** Turn the form's text areas into the exercise shape. */
export function fromForm(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  const lines = (k: string) => s(k).split("\n").map((l) => l.trim()).filter(Boolean);
  const type = s("type");
  return {
    code: s("code") || undefined,
    type,
    direction: s("direction"),
    level: s("level"),
    topic: s("topic"),
    sourceText: s("sourceText"),
    references: type === "MULTIPLE_CHOICE" ? lines("options").filter((l) => l.startsWith("*")).map((l) => l.slice(1).trim()) : lines("references"),
    gapTemplate: type === "FILL_GAP" ? s("gapTemplate") : undefined,
    options: type === "MULTIPLE_CHOICE" ? lines("options").map((l) => ({ text: l.replace(/^\*/, "").trim(), correct: l.startsWith("*") })) : undefined,
    keyVocabulary: lines("keyVocabulary").map((l) => {
      const [source, ...rest] = l.split("=");
      return { source: source.trim(), target: rest.join("=").trim() };
    }).filter((v) => v.source && v.target),
    commonMistakes: s("commonMistakes") || undefined,
  };
}

export async function saveExercise(user: User, id: string | null, input: ExerciseInput) {
  const role = await canManage(user);
  if (!role) throw new Error("FORBIDDEN");
  const data = {
    type: input.type,
    direction: input.direction,
    level: input.level,
    topic: input.topic,
    sourceText: input.sourceText,
    references: input.references,
    gapTemplate: input.gapTemplate ?? null,
    options: input.options ?? undefined,
    keyVocabulary: input.keyVocabulary ?? undefined,
    commonMistakes: input.commonMistakes ?? null,
  };
  if (id) {
    const existing = await db.exercise.findUnique({ where: { id } });
    // Teachers edit only their own drafts
    if (!existing || (role === "teacher" && (existing.authorId !== user.id || existing.status !== "DRAFT"))) throw new Error("FORBIDDEN");
    return db.exercise.update({ where: { id }, data: { ...data, code: role === "admin" ? input.code ?? existing.code : existing.code } });
  }
  return db.exercise.create({ data: { ...data, code: role === "admin" ? input.code : undefined, status: "DRAFT", authorId: user.id } });
}

export async function importExercises(user: User, list: unknown) {
  if ((await canManage(user)) !== "admin") throw new Error("FORBIDDEN");
  const parsed = z.array(exerciseInput.and(z.object({ code: z.string() }))).max(500).safeParse(list);
  if (!parsed.success) return { error: parsed.error.issues[0]?.path.join(".") ?? "invalid" };
  for (const e of parsed.data) {
    const { code, ...rest } = e;
    const data = { ...rest, gapTemplate: rest.gapTemplate ?? null, commonMistakes: rest.commonMistakes ?? null };
    await db.exercise.upsert({ where: { code }, create: { code, status: "DRAFT", authorId: user.id, ...data }, update: data });
  }
  return { count: parsed.data.length };
}

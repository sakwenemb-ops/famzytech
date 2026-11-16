"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertRole } from "./session";
import { notify } from "./notify";
import type { FormState } from "./auth-actions";

const REVIEW_DAYS = 30;
const TOP_RATED = { minAvg: 4.8, minLessons: 20 };

/** Recompute a teacher's rating and the "Top rated" badge from their visible reviews. */
async function refreshRating(teacherId: string) {
  const agg = await db.review.aggregate({ where: { teacherId, hidden: false }, _avg: { rating: true }, _count: true });
  const avg = Math.round((agg._avg.rating ?? 0) * 10) / 10;
  const t = await db.teacherProfile.update({ where: { id: teacherId }, data: { ratingAvg: avg, ratingCount: agg._count } });
  const deserves = avg >= TOP_RATED.minAvg && t.lessonsCompleted >= TOP_RATED.minLessons;
  if (deserves) await db.teacherBadge.upsert({ where: { teacherId_type: { teacherId, type: "TOP_RATED" } }, create: { teacherId, type: "TOP_RATED" }, update: {} });
  else await db.teacherBadge.deleteMany({ where: { teacherId, type: "TOP_RATED" } });
}

/** A student rates a lesson that took place, once, within 30 days. */
export async function submitReviewAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await assertRole("STUDENT");
  const parsed = z
    .object({ bookingId: z.string().min(1), rating: z.coerce.number().int().min(1, "rating_required").max(5), comment: z.string().trim().max(1500).optional() })
    .safeParse({ bookingId: fd.get("bookingId"), rating: fd.get("rating") ?? 0, comment: String(fd.get("comment") ?? "") || undefined });
  if (!parsed.success) return { errors: { rating: "rating_required" } };
  const { bookingId, rating, comment } = parsed.data;

  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { student: true, review: true } });
  if (!b || b.student.userId !== user.id || b.status !== "COMPLETED" || b.review) return { message: "review_not_allowed" };
  if (Date.now() - b.endsAt.getTime() > REVIEW_DAYS * 86_400_000) return { message: "review_not_allowed" };

  await db.review.create({ data: { bookingId, studentId: b.studentId, teacherId: b.teacherId, rating, comment } });
  await refreshRating(b.teacherId);
  revalidatePath("/[locale]", "layout");
  return { ok: true, message: "thanks" };
}

/** The teacher's notes and homework after a lesson; the student is told the first time. */
export async function saveLessonNotesAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await assertRole("TEACHER");
  const parsed = z
    .object({ bookingId: z.string().min(1), teacherNotes: z.string().trim().max(5000), homework: z.string().trim().max(5000) })
    .safeParse({ bookingId: fd.get("bookingId"), teacherNotes: String(fd.get("teacherNotes") ?? ""), homework: String(fd.get("homework") ?? "") });
  if (!parsed.success) return { message: "invalid" };
  const { bookingId, teacherNotes, homework } = parsed.data;

  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { teacher: true, student: true, lesson: true } });
  if (!b?.lesson || b.teacher.userId !== user.id || !["COMPLETED", "NO_SHOW_STUDENT"].includes(b.status)) return { message: "invalid" };
  const first = !b.lesson.teacherNotes && !b.lesson.homework;
  await db.lesson.update({ where: { id: b.lesson.id }, data: { teacherNotes: teacherNotes || null, homework: homework || null } });
  if (first && (teacherNotes || homework)) {
    await notify(b.student.userId, {
      type: "LESSON_NOTES",
      title: { en: "Notes from your lesson", fr: "Notes de votre cours" },
      body: { en: `${user.name} added notes and homework for your lesson.`, fr: `${user.name} a ajouté des notes et des devoirs pour votre cours.` },
      link: `/lesson/${b.id}`,
    });
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true, message: "saved" };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertRole } from "./session";
import { notify } from "./notify";
import { refreshRating } from "./ratings";
import type { FormState } from "./auth-actions";

const REVIEW_DAYS = 30;

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

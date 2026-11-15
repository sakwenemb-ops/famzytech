"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseWeeklySlots } from "@/lib/availability";
import { zonedTimeToUtc } from "@/lib/slots";
import { redirect } from "@/i18n/navigation";
import { assertRole } from "./session";
import { cancelBooking, holdSlot, rescheduleBooking, teacherSlots, type BookingOption } from "./booking";
import type { FormState } from "./auth-actions";

const DAY = 86_400_000;

/** Free slots for the booking calendar (public). The range is limited to two weeks, up to 90 days ahead. */
export async function getSlotsAction(teacherId: string, fromIso: string, toIso: string) {
  const now = Date.now();
  const from = new Date(Math.max(new Date(fromIso).getTime(), now));
  const to = new Date(Math.min(new Date(toIso).getTime(), from.getTime() + 14 * DAY, now + 90 * DAY));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return [];
  const teacher = await db.teacherProfile.findUnique({ where: { id: teacherId }, select: { isPublished: true } });
  if (!teacher?.isPublished) return [];
  return (await teacherSlots(teacherId, from, to)).map((d) => d.toISOString());
}

const OPTIONS = ["TRIAL", "SINGLE", "PACK_5", "PACK_10", "PACK_20", "CREDIT"] as const;

export async function holdAction(teacherId: string, startIso: string, option: BookingOption) {
  const user = await assertRole("STUDENT");
  const parsed = z.object({ start: z.string().datetime(), option: z.enum(OPTIONS) }).safeParse({ start: startIso, option });
  if (!parsed.success) return { error: "not_bookable" as const };
  const res = await holdSlot(user, teacherId, new Date(parsed.data.start), parsed.data.option);
  if ("error" in res) return res;
  const locale = await getLocale();
  if (res.booking.status === "CONFIRMED") redirect({ href: `/student/lessons?booked=${res.booking.id}`, locale });
  redirect({ href: `/checkout/${res.booking.id}`, locale });
}

export async function cancelAction(bookingId: string) {
  const user = await assertRole("STUDENT", "TEACHER");
  const res = await cancelBooking(user, bookingId);
  revalidatePath("/[locale]", "layout");
  return res;
}

export async function rescheduleAction(bookingId: string, startIso: string) {
  const user = await assertRole("STUDENT");
  if (!z.string().datetime().safeParse(startIso).success) return { error: "slot_taken" as const };
  const res = await rescheduleBooking(user, bookingId, new Date(startIso));
  revalidatePath("/[locale]", "layout");
  return res;
}

// ─── Teacher calendar: weekly hours and time off (no review needed) ───

async function teacherProfile() {
  const user = await assertRole("TEACHER");
  const t = await db.teacherProfile.findUniqueOrThrow({ where: { userId: user.id } });
  return { user, t };
}

export async function saveWeeklyHoursAction(_: FormState, fd: FormData): Promise<FormState> {
  const { t } = await teacherProfile();
  const parsed = parseWeeklySlots(String(fd.get("slots") ?? ""));
  if ("error" in parsed) return { errors: { slots: parsed.error } };
  await db.$transaction([
    db.availabilityRule.deleteMany({ where: { teacherId: t.id } }),
    db.availabilityRule.createMany({ data: parsed.slots.map((s) => ({ ...s, teacherId: t.id })) }),
  ]);
  revalidatePath("/[locale]/teacher/calendar", "page");
  return { ok: true, message: "saved" };
}

/** Whole days off, from the first to the last day (inclusive), in the teacher's time zone. */
export async function addTimeOffAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, t } = await teacherProfile();
  const day = /^(\d{4})-(\d{2})-(\d{2})$/;
  const a = day.exec(String(fd.get("from") ?? ""));
  const b = day.exec(String(fd.get("to") ?? "") || String(fd.get("from") ?? ""));
  if (!a || !b) return { errors: { from: "required" } };
  const startsAt = zonedTimeToUtc(+a[1], +a[2], +a[3], 0, user.timeZone);
  const endsAt = zonedTimeToUtc(+b[1], +b[2], +b[3] + 1, 0, user.timeZone);
  if (endsAt <= startsAt) return { errors: { to: "range_invalid" } };
  if (endsAt.getTime() - startsAt.getTime() > 92 * DAY) return { errors: { to: "range_too_long" } };
  await db.availabilityException.create({ data: { teacherId: t.id, startsAt, endsAt, available: false } });
  revalidatePath("/[locale]/teacher/calendar", "page");
  return { ok: true, message: "saved" };
}

export async function removeTimeOffAction(id: string) {
  const { t } = await teacherProfile();
  await db.availabilityException.deleteMany({ where: { id, teacherId: t.id } });
  revalidatePath("/[locale]/teacher/calendar", "page");
}

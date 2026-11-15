import "server-only";
import { randomUUID } from "node:crypto";
import type { Booking, TeacherProfile, User } from "@prisma/client";
import { db } from "@/lib/db";
import { LESSON_MIN, freeSlots, isFreeSlot } from "@/lib/slots";
import { getSetting } from "./settings";
import { notify } from "./notify";
import { earnLesson, refundCancelledLesson } from "./payments/lesson-money";

export const HOLD_MIN = 15;
export const PACK_SIZES = [5, 10, 20] as const;
export type PackSize = (typeof PACK_SIZES)[number];
export type BookingOption = "TRIAL" | "SINGLE" | "PACK_5" | "PACK_10" | "PACK_20" | "CREDIT";

const ACTIVE_HOLD = (now: Date) => ({ status: "HELD" as const, holdExpiresAt: { gt: now } });

/** Bookings that block a teacher's time: confirmed lessons and holds still being paid. */
async function busyFor(where: { teacherId?: string; studentId?: string }, excludeId?: string) {
  const now = new Date();
  return db.booking.findMany({
    where: { ...where, id: excludeId ? { not: excludeId } : undefined, OR: [{ status: "CONFIRMED" }, ACTIVE_HOLD(now)] },
    select: { startsAt: true, endsAt: true },
  });
}

async function slotContext(teacher: TeacherProfile & { user: Pick<User, "timeZone"> }, excludeId?: string) {
  const [rules, exceptions, busy, noticeH] = await Promise.all([
    db.availabilityRule.findMany({ where: { teacherId: teacher.id } }),
    db.availabilityException.findMany({ where: { teacherId: teacher.id, endsAt: { gt: new Date() } } }),
    busyFor({ teacherId: teacher.id }, excludeId),
    getSetting("minBookingNoticeHours"),
  ]);
  return { rules, exceptions, busy, teacherTimeZone: teacher.user.timeZone, minNoticeMin: noticeH * 60 };
}

/** Free start times for a teacher in [from, to). */
export async function teacherSlots(teacherId: string, from: Date, to: Date) {
  const teacher = await db.teacherProfile.findUnique({ where: { id: teacherId }, include: { user: { select: { timeZone: true } } } });
  if (!teacher) return [];
  return freeSlots({ ...(await slotContext(teacher)), from, to });
}

// ─── Prices ───

export function packDiscount(t: Pick<TeacherProfile, "package5Discount" | "package10Discount" | "package20Discount">, size: PackSize) {
  return size === 5 ? t.package5Discount : size === 10 ? t.package10Discount : t.package20Discount;
}

/** What one lesson costs for each option, and what the student pays now. */
export function priceFor(t: TeacherProfile, option: BookingOption) {
  const rate = t.hourlyRateXaf ?? 0;
  if (option === "TRIAL") return { perLesson: t.trialRateXaf ?? rate, total: t.trialRateXaf ?? rate, discountPct: 0 };
  if (option === "SINGLE") return { perLesson: rate, total: rate, discountPct: 0 };
  if (option === "CREDIT") return { perLesson: 0, total: 0, discountPct: 0 };
  const size = Number(option.split("_")[1]) as PackSize;
  const discountPct = packDiscount(t, size);
  const perLesson = Math.round((rate * (100 - discountPct)) / 100);
  return { perLesson, total: perLesson * size, discountPct, size };
}

/** A trial is for students who have never had a lesson with this teacher. */
export async function trialAvailable(studentId: string, teacherId: string) {
  const previous = await db.booking.count({
    where: {
      studentId,
      teacherId,
      OR: [{ status: { in: ["CONFIRMED", "COMPLETED", "NO_SHOW_STUDENT", "DISPUTED"] } }, ACTIVE_HOLD(new Date())],
    },
  });
  return previous === 0;
}

/** A paid pack with lessons left, if any. */
export async function packWithCredit(studentId: string, teacherId: string) {
  const packs = await db.lessonPackage.findMany({ where: { studentId, teacherId }, orderBy: { createdAt: "asc" } });
  return packs.find((p) => p.usedLessons < p.totalLessons && (!p.expiresAt || p.expiresAt > new Date())) ?? null;
}

// ─── Holding a slot ───

export type HoldError = "not_bookable" | "slot_taken" | "student_busy" | "trial_used" | "no_credit" | "own_profile";

const isOverlapError = (e: unknown) => String((e as Error)?.message ?? e).includes("booking_no_overlap");

/**
 * Reserve a slot. Paid options are HELD for 15 minutes while the student pays;
 * a pack credit confirms the lesson at once.
 */
export async function holdSlot(student: User, teacherId: string, startsAt: Date, option: BookingOption): Promise<{ booking: Booking } | { error: HoldError }> {
  const sp = await db.studentProfile.findUnique({ where: { userId: student.id } });
  const teacher = await db.teacherProfile.findUnique({ where: { id: teacherId }, include: { user: true } });
  if (!sp || !teacher || !teacher.isPublished || teacher.user.status !== "ACTIVE" || teacher.hourlyRateXaf == null) return { error: "not_bookable" };
  if (teacher.userId === student.id) return { error: "own_profile" };

  if (!isFreeSlot(startsAt, await slotContext(teacher))) return { error: "slot_taken" };
  const endsAt = new Date(startsAt.getTime() + LESSON_MIN * 60_000);
  const mine = await busyFor({ studentId: sp.id });
  if (mine.some((b) => startsAt < b.endsAt && endsAt > b.startsAt)) return { error: "student_busy" };
  if (option === "TRIAL" && !(await trialAvailable(sp.id, teacher.id))) return { error: "trial_used" };

  const commissionPct = await getSetting("commissionPct");
  const now = new Date();
  try {
    if (option === "CREDIT") {
      const booking = await db.$transaction(async (tx) => {
        const pack = await packWithCredit(sp.id, teacher.id);
        if (!pack) throw new Error("NO_CREDIT");
        // Take one credit only if one is still left (safe against double clicks)
        const taken = await tx.lessonPackage.updateMany({ where: { id: pack.id, usedLessons: { lt: pack.totalLessons } }, data: { usedLessons: { increment: 1 } } });
        if (taken.count === 0) throw new Error("NO_CREDIT");
        await tx.booking.updateMany({ where: { teacherId: teacher.id, status: "HELD", holdExpiresAt: { lte: now } }, data: { status: "EXPIRED" } });
        return tx.booking.create({
          data: { studentId: sp.id, teacherId: teacher.id, type: "PACKAGE", status: "CONFIRMED", startsAt, endsAt, priceXaf: pack.unitPriceXaf, commissionPct, packageId: pack.id },
        });
      });
      await afterConfirm(booking.id);
      return { booking };
    }

    const price = priceFor(teacher, option);
    const booking = await db.$transaction(async (tx) => {
      // Holds that ran out are released first, so they don't block the slot
      await tx.booking.updateMany({ where: { teacherId: teacher.id, status: "HELD", holdExpiresAt: { lte: now } }, data: { status: "EXPIRED" } });
      return tx.booking.create({
        data: {
          studentId: sp.id,
          teacherId: teacher.id,
          type: option === "TRIAL" ? "TRIAL" : option === "SINGLE" ? "SINGLE" : "PACKAGE",
          status: "HELD",
          startsAt,
          endsAt,
          priceXaf: price.perLesson,
          packageSize: "size" in price ? price.size : null,
          commissionPct,
          holdExpiresAt: new Date(now.getTime() + HOLD_MIN * 60_000),
        },
      });
    });
    return { booking };
  } catch (e) {
    if (isOverlapError(e)) return { error: "slot_taken" };
    if ((e as Error).message === "NO_CREDIT") return { error: "no_credit" };
    throw e;
  }
}

/** What the student pays for this held booking (a pack is paid in full up front). */
export const amountDue = (b: Pick<Booking, "priceXaf" | "packageSize">) => b.priceXaf * (b.packageSize ?? 1);

// ─── Confirming ───

/**
 * Called once payment succeeds (Phase 5) or by the development payment button.
 * Turns the hold into a lesson, creates the pack if one was bought, and tells both people.
 */
export async function confirmBooking(bookingId: string): Promise<{ ok: true } | { error: "not_found" | "expired" }> {
  const now = new Date();
  const done = await db.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!b) return "not_found" as const;
    if (b.status === "CONFIRMED") return "ok" as const;
    if (b.status !== "HELD" || !b.holdExpiresAt || b.holdExpiresAt <= now) return "expired" as const;
    let packageId: string | null = null;
    if (b.packageSize) {
      const t = await tx.teacherProfile.findUniqueOrThrow({ where: { id: b.teacherId } });
      const pack = await tx.lessonPackage.create({
        data: {
          studentId: b.studentId,
          teacherId: b.teacherId,
          totalLessons: b.packageSize,
          usedLessons: 1,
          priceXaf: amountDue(b),
          unitPriceXaf: b.priceXaf,
          discountPct: packDiscount(t, b.packageSize as PackSize),
        },
      });
      packageId = pack.id;
    }
    await tx.booking.update({ where: { id: b.id }, data: { status: "CONFIRMED", holdExpiresAt: null, packageId: packageId ?? b.packageId } });
    return "ok" as const;
  });
  if (done !== "ok") return { error: done };
  await afterConfirm(bookingId);
  return { ok: true };
}

async function afterConfirm(bookingId: string) {
  const b = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { student: { include: { user: true } }, teacher: { include: { user: true } } },
  });
  await db.lesson.upsert({ where: { bookingId }, create: { bookingId, roomName: `lq-${randomUUID()}` }, update: {} });

  const when = (u: User) =>
    new Intl.DateTimeFormat(u.locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "full", timeStyle: "short", timeZone: u.timeZone }).format(b.startsAt);
  const s = b.student.user, t = b.teacher.user;
  await notify(s.id, {
    type: "BOOKING_CONFIRMED",
    title: { en: "Lesson booked", fr: "Cours réservé" },
    body: { en: `Your lesson with ${t.name} is booked for ${when(s)}.`, fr: `Votre cours avec ${t.name} est réservé pour le ${when(s)}.` },
    link: "/student/lessons",
  });
  await notify(t.id, {
    type: "BOOKING_CONFIRMED",
    title: { en: "New lesson booked", fr: "Nouveau cours réservé" },
    body: { en: `${s.name} booked a lesson with you on ${when(t)}.`, fr: `${s.name} a réservé un cours avec vous le ${when(t)}.` },
    link: "/teacher/lessons",
  });
}

// ─── Cancelling and rescheduling ───

export type ChangeError = "not_found" | "not_allowed" | "too_late" | "slot_taken";

async function bookingFor(user: User, id: string) {
  const b = await db.booking.findUnique({
    where: { id },
    include: { student: { include: { user: true } }, teacher: { include: { user: true } } },
  });
  if (!b) return null;
  const role = b.student.userId === user.id ? "student" : b.teacher.userId === user.id ? "teacher" : null;
  return role ? { b, role } : null;
}

/** Hours before the lesson inside which a student cancellation is not refunded. */
export async function cancelPolicy() {
  return { freeCancelHours: await getSetting("freeCancelHours") };
}

/**
 * Student cancels: free until 12 hours before (lesson refunded or pack credit returned);
 * later, the teacher is still paid. Teacher cancels: always refunded in full.
 * Money moves are added in Phase 5; this records what is owed.
 */
export async function cancelBooking(user: User, id: string): Promise<{ ok: true; refunded: boolean } | { error: ChangeError }> {
  const found = await bookingFor(user, id);
  if (!found) return { error: "not_found" };
  const { b, role } = found;
  const now = new Date();

  if (b.status === "HELD") {
    if (role !== "student") return { error: "not_allowed" };
    await db.booking.update({ where: { id }, data: { status: "EXPIRED", cancelledAt: now, cancelledById: user.id } });
    return { ok: true, refunded: false };
  }
  if (b.status !== "CONFIRMED" || b.startsAt <= now) return { error: "not_allowed" };

  const { freeCancelHours } = await cancelPolicy();
  const early = b.startsAt.getTime() - now.getTime() >= freeCancelHours * 3_600_000;
  const refunded = role === "teacher" || early;
  const releaseH = await getSetting("escrowReleaseHours");

  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: {
        status: role === "teacher" ? "CANCELLED_BY_TEACHER" : "CANCELLED_BY_STUDENT",
        cancelledAt: now,
        cancelledById: user.id,
        // A late cancellation is paid to the teacher like a lesson, after the usual 24-hour window
        releaseAt: refunded ? null : new Date(b.endsAt.getTime() + releaseH * 3_600_000),
      },
    });
    // Lessons paid with a pack credit get the credit back
    if (refunded && b.packageId) await tx.lessonPackage.update({ where: { id: b.packageId }, data: { usedLessons: { decrement: 1 } } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "BOOKING_CANCELLED",
        targetType: "Booking",
        targetId: id,
        meta: { by: role, refunded, lateCancel: !early && role === "student" },
      },
    });
  });
  // Money: back to the student's wallet, or to the teacher for a late cancellation
  if (refunded) await refundCancelledLesson(b, b.student.userId);
  else await earnLesson(b, b.teacher.userId);

  const other = role === "student" ? b.teacher.user : b.student.user;
  const when = new Intl.DateTimeFormat(other.locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "full", timeStyle: "short", timeZone: other.timeZone }).format(b.startsAt);
  await notify(other.id, {
    type: "BOOKING_CANCELLED",
    title: { en: "Lesson cancelled", fr: "Cours annulé" },
    body: { en: `${user.name} cancelled the lesson of ${when}.`, fr: `${user.name} a annulé le cours du ${when}.` },
    link: role === "student" ? "/teacher/lessons" : "/student/lessons",
  });
  return { ok: true, refunded };
}

/** Students may move a lesson to another free slot of the same teacher, until 12 hours before it. */
export async function rescheduleBooking(user: User, id: string, newStart: Date): Promise<{ ok: true } | { error: ChangeError }> {
  const found = await bookingFor(user, id);
  if (!found) return { error: "not_found" };
  const { b, role } = found;
  if (role !== "student" || b.status !== "CONFIRMED") return { error: "not_allowed" };
  const { freeCancelHours } = await cancelPolicy();
  if (b.startsAt.getTime() - Date.now() < freeCancelHours * 3_600_000) return { error: "too_late" };
  if (!isFreeSlot(newStart, await slotContext(b.teacher, b.id))) return { error: "slot_taken" };

  try {
    await db.booking.update({
      where: { id },
      data: {
        startsAt: newStart,
        endsAt: new Date(newStart.getTime() + LESSON_MIN * 60_000),
        rescheduledFrom: b.startsAt.toISOString(),
        reminder24SentAt: null,
        reminder1SentAt: null,
      },
    });
  } catch (e) {
    if (isOverlapError(e)) return { error: "slot_taken" };
    throw e;
  }
  const t = b.teacher.user;
  const fmt = (d: Date) => new Intl.DateTimeFormat(t.locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "full", timeStyle: "short", timeZone: t.timeZone }).format(d);
  await notify(t.id, {
    type: "BOOKING_RESCHEDULED",
    title: { en: "Lesson moved", fr: "Cours déplacé" },
    body: {
      en: `${user.name} moved the lesson of ${fmt(b.startsAt)} to ${fmt(newStart)}.`,
      fr: `${user.name} a déplacé le cours du ${fmt(b.startsAt)} au ${fmt(newStart)}.`,
    },
    link: "/teacher/lessons",
  });
  return { ok: true };
}

// ─── Background jobs ───

/** Mark holds whose 15 minutes ran out. Run every few minutes. */
export async function expireHolds(now = new Date()) {
  const r = await db.booking.updateMany({ where: { status: "HELD", holdExpiresAt: { lte: now } }, data: { status: "EXPIRED" } });
  return r.count;
}

/** Send 24-hour and 1-hour reminders. Run every 10–15 minutes. */
export async function sendReminders(now = new Date()) {
  let sent = 0;
  for (const [field, hours] of [["reminder24SentAt", 24], ["reminder1SentAt", 1]] as const) {
    const due = await db.booking.findMany({
      where: { status: "CONFIRMED", [field]: null, startsAt: { gt: now, lte: new Date(now.getTime() + hours * 3_600_000) } },
      include: { student: { include: { user: true } }, teacher: { include: { user: true } } },
    });
    for (const b of due) {
      // Mark first, so a crash never sends the same reminder twice
      const claimed = await db.booking.updateMany({ where: { id: b.id, [field]: null }, data: { [field]: now } });
      if (!claimed.count) continue;
      // A lesson booked 3 hours ahead gets the 1-hour reminder only
      if (hours === 24 && b.startsAt.getTime() - now.getTime() < 2 * 3_600_000) continue;
      for (const [u, other, link] of [[b.student.user, b.teacher.user, "/student/lessons"], [b.teacher.user, b.student.user, "/teacher/lessons"]] as const) {
        const when = new Intl.DateTimeFormat(u.locale === "fr" ? "fr-FR" : "en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: u.timeZone }).format(b.startsAt);
        await notify(u.id, {
          type: hours === 24 ? "LESSON_REMINDER_24H" : "LESSON_REMINDER_1H",
          title: hours === 24 ? { en: "Lesson tomorrow", fr: "Cours demain" } : { en: "Lesson in 1 hour", fr: "Cours dans 1 heure" },
          body: { en: `Your lesson with ${other.name} starts ${when}.`, fr: `Votre cours avec ${other.name} commence ${when}.` },
          link,
        });
        sent++;
      }
    }
  }
  return sent;
}

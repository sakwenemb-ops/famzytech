import "server-only";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";

/** The classroom opens 10 minutes before the lesson and closes 30 minutes after it ends. */
export const OPEN_BEFORE_MIN = 10;
export const CLOSE_AFTER_MIN = 30;

export function roomWindow(b: { startsAt: Date; endsAt: Date }) {
  return {
    opensAt: new Date(b.startsAt.getTime() - OPEN_BEFORE_MIN * 60_000),
    closesAt: new Date(b.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000),
  };
}

export function isRoomOpen(b: { startsAt: Date; endsAt: Date; status: string }, now = new Date()) {
  const w = roomWindow(b);
  return b.status === "CONFIRMED" && now >= w.opensAt && now <= w.closesAt;
}

/**
 * Load a lesson for someone who belongs in it. Students and teachers of the lesson can
 * take part; admins can read the record (for disputes) but never join the live call.
 */
export async function lessonFor(user: User, bookingId: string) {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    include: { lesson: true, student: { include: { user: true } }, teacher: { include: { user: true } }, review: true },
  });
  if (!b?.lesson) return null;
  const role = b.student.userId === user.id ? "student" : b.teacher.userId === user.id ? "teacher" : user.role === "ADMIN" ? "admin" : null;
  if (!role) return null;
  return { b, lesson: b.lesson, role } as const;
}

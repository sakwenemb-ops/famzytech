import "server-only";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { redactContacts } from "@/lib/contact-filter";
import { notify, ping } from "./notify";
import { rateLimit } from "./rate-limit";

export const MAX_MESSAGE = 2000;
/** Bookings that mean the student has paid for a lesson with this teacher. */
const PAID = ["CONFIRMED", "COMPLETED", "NO_SHOW_STUDENT", "NO_SHOW_TEACHER", "DISPUTED", "CANCELLED_BY_STUDENT"] as const;

export type MessagingError = "not_allowed" | "too_many" | "empty" | "too_long" | "not_found";
export class MessagingFailure extends Error {
  constructor(public code: MessagingError) {
    super(code);
  }
}

/**
 * Who may start a conversation: a student with any published teacher, or a teacher
 * with a student who booked them. Admins don't take part in conversations.
 */
export async function startConversation(user: User, otherUserId: string) {
  if (user.id === otherUserId) throw new MessagingFailure("not_allowed");
  const other = await db.user.findUnique({ where: { id: otherUserId }, include: { teacherProfile: true, studentProfile: true } });
  if (!other || other.status !== "ACTIVE") throw new MessagingFailure("not_found");

  let studentId: string, teacherId: string;
  if (user.role === "STUDENT" && other.role === "TEACHER") {
    if (!other.teacherProfile?.isPublished) throw new MessagingFailure("not_allowed");
    [studentId, teacherId] = [user.id, other.id];
  } else if (user.role === "TEACHER" && other.role === "STUDENT") {
    const tp = await db.teacherProfile.findUnique({ where: { userId: user.id } });
    const booked = tp && other.studentProfile && (await db.booking.count({ where: { teacherId: tp.id, studentId: other.studentProfile.id, status: { not: "HELD" } } }));
    if (!booked) throw new MessagingFailure("not_allowed");
    [studentId, teacherId] = [other.id, user.id];
  } else throw new MessagingFailure("not_allowed");

  const existing = await db.conversation.findUnique({ where: { studentId_teacherId: { studentId, teacherId } } });
  if (existing) return existing;
  // Students can open at most 10 new conversations a day (stops mass messaging of teachers)
  if (user.role === "STUDENT" && !rateLimit(`conv:${user.id}`, 10, 86_400_000)) throw new MessagingFailure("too_many");
  return db.conversation.upsert({ where: { studentId_teacherId: { studentId, teacherId } }, create: { studentId, teacherId }, update: {} });
}

/** The conversation, if this person is in it. */
export async function conversationFor(user: User, id: string) {
  const c = await db.conversation.findUnique({ where: { id }, include: { student: true, teacher: true } });
  if (!c || (c.studentId !== user.id && c.teacherId !== user.id)) return null;
  return c;
}

/** Contact details may be shared once the student has paid for a lesson with this teacher. */
export async function contactAllowed(c: { studentId: string; teacherId: string; contactUnlocked: boolean }) {
  if (c.contactUnlocked) return true;
  const n = await db.booking.count({ where: { status: { in: [...PAID] }, student: { userId: c.studentId }, teacher: { userId: c.teacherId } } });
  if (n > 0) await db.conversation.updateMany({ where: { studentId: c.studentId, teacherId: c.teacherId }, data: { contactUnlocked: true } });
  return n > 0;
}

export async function sendMessage(user: User, conversationId: string, raw: string) {
  const c = await conversationFor(user, conversationId);
  if (!c) throw new MessagingFailure("not_found");
  const other = c.studentId === user.id ? c.teacher : c.student;
  if (other.status !== "ACTIVE") throw new MessagingFailure("not_allowed");
  const body = raw.replace(/\r\n/g, "\n").trim();
  if (!body) throw new MessagingFailure("empty");
  if (body.length > MAX_MESSAGE) throw new MessagingFailure("too_long");
  if (!rateLimit(`msg:${user.id}`, 20, 5 * 60_000)) throw new MessagingFailure("too_many");

  const filtered = (await contactAllowed(c)) ? { text: body, redacted: false } : redactContacts(body);
  // Email the other person only for the first unread message, not for every one
  const alreadyWaiting = await db.message.count({ where: { conversationId: c.id, senderId: user.id, readAt: null } });
  const msg = await db.$transaction(async (t) => {
    const m = await t.message.create({ data: { conversationId: c.id, senderId: user.id, body: filtered.text, redacted: filtered.redacted } });
    await t.conversation.update({ where: { id: c.id }, data: { lastMessageAt: m.createdAt } });
    return m;
  });

  ping(other.id, "message", c.id);
  if (!alreadyWaiting) {
    await notify(other.id, {
      type: "MESSAGE_NEW",
      inApp: false, // the message badge already shows it
      title: { en: `New message from ${user.name}`, fr: `Nouveau message de ${user.name}` },
      body: { en: filtered.text.slice(0, 160), fr: filtered.text.slice(0, 160) },
      link: `/messages/${c.id}`,
    });
  }
  return msg;
}

/** Mark the other person's messages as read. Returns how many changed. */
export async function markRead(user: User, conversationId: string) {
  const r = await db.message.updateMany({ where: { conversationId, senderId: { not: user.id }, readAt: null }, data: { readAt: new Date() } });
  if (r.count) {
    const c = await db.conversation.findUnique({ where: { id: conversationId } });
    if (c) ping(c.studentId === user.id ? c.teacherId : c.studentId, "message", c.id); // shows "read" to the sender
  }
  return r.count;
}

export async function inbox(user: User) {
  const convs = await db.conversation.findMany({
    where: { OR: [{ studentId: user.id }, { teacherId: user.id }] },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      student: { select: { id: true, name: true, image: true } },
      teacher: { select: { id: true, name: true, image: true, teacherProfile: { select: { photoUrl: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const unread = await db.message.groupBy({
    by: ["conversationId"],
    where: { conversationId: { in: convs.map((c) => c.id) }, senderId: { not: user.id }, readAt: null },
    _count: true,
  });
  return convs.map((c) => ({ ...c, unread: unread.find((u) => u.conversationId === c.id)?._count ?? 0 }));
}

export async function reportConversation(user: User, conversationId: string, reason: string) {
  const c = await conversationFor(user, conversationId);
  if (!c) throw new MessagingFailure("not_found");
  await db.$transaction([
    db.conversation.update({ where: { id: c.id }, data: { reportedAt: new Date(), reportedById: user.id, reportReason: reason.slice(0, 1000) } }),
    db.auditLog.create({ data: { actorId: user.id, action: "CONVERSATION_REPORTED", targetType: "Conversation", targetId: c.id, meta: { reason: reason.slice(0, 1000) } } }),
  ]);
}

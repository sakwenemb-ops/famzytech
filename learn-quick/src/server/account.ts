import "server-only";
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { deleteDocument } from "./files";

/** Reasons an account can't be deleted yet (each must be settled first, so nobody loses money or a lesson). */
export type Blocker = "upcoming_lessons" | "balance" | "payout_pending" | "dispute_open" | "payment_pending" | "admin";

export async function deletionBlockers(user: User): Promise<Blocker[]> {
  if (user.role === "ADMIN") return ["admin"];
  const out: Blocker[] = [];
  const mine = { OR: [{ student: { userId: user.id } }, { teacher: { userId: user.id } }] };
  const [upcoming, accounts, payouts, disputes, payments] = await Promise.all([
    db.booking.count({ where: { ...mine, status: { in: ["HELD", "CONFIRMED"] }, endsAt: { gt: new Date() } } }),
    db.ledgerAccount.findMany({ where: { userId: user.id, type: { in: ["STUDENT_WALLET", "TEACHER_PENDING", "TEACHER_AVAILABLE"] } } }),
    db.payout.count({ where: { userId: user.id, status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] } } }),
    db.dispute.count({ where: { status: "OPEN", booking: mine } }),
    db.payment.count({ where: { userId: user.id, status: "PENDING" } }),
  ]);
  if (upcoming) out.push("upcoming_lessons");
  if (accounts.some((a) => a.balanceXaf > 0)) out.push("balance");
  if (payouts) out.push("payout_pending");
  if (disputes) out.push("dispute_open");
  if (payments) out.push("payment_pending");
  return out;
}

export class DeletionRefused extends Error {
  constructor(public code: "wrong_password" | "confirm_required" | "blocked") {
    super(code);
  }
}

/**
 * Deletes the account as promised in the privacy policy: the person can no longer sign in, their
 * contact details, profile and uploaded documents are erased, and they appear as "Deleted user".
 * Bookings, payments and the ledger stay (accounting obligation), without the person's details.
 * Files shared in a lesson stay visible to the other participant.
 */
export async function deleteAccount(user: User, proof: { password?: string; confirm?: string }) {
  if (user.passwordHash) {
    if (!proof.password || !(await bcrypt.compare(proof.password, user.passwordHash))) throw new DeletionRefused("wrong_password");
  } else if ((proof.confirm ?? "").trim().toUpperCase() !== "DELETE" && (proof.confirm ?? "").trim().toUpperCase() !== "SUPPRIMER") {
    throw new DeletionRefused("confirm_required");
  }
  if ((await deletionBlockers(user)).length) throw new DeletionRefused("blocked");

  const teacher = await db.teacherProfile.findUnique({ where: { userId: user.id } });
  const docs = await db.document.findMany({ where: { ownerId: user.id, kind: { not: "LESSON_FILE" } }, select: { id: true } });

  await db.$transaction(async (t) => {
    if (teacher) {
      await t.certificate.deleteMany({ where: { teacherId: teacher.id } });
      await t.education.deleteMany({ where: { teacherId: teacher.id } });
      await t.availabilityRule.deleteMany({ where: { teacherId: teacher.id } });
      await t.availabilityException.deleteMany({ where: { teacherId: teacher.id } });
      await t.favoriteTeacher.deleteMany({ where: { teacherId: teacher.id } });
      await t.teacherApplication.updateMany({ where: { teacherId: teacher.id }, data: { idFrontDocId: null, idBackDocId: null, idSelfieDocId: null } });
      await t.teacherProfile.update({
        where: { id: teacher.id },
        data: { isPublished: false, headlineEn: null, headlineFr: null, bioEn: null, bioFr: null, experienceEn: null, experienceFr: null, photoUrl: null, videoUrl: null, payoutPhone: null, countryOfBirth: null },
      });
    }
    await t.studentProfile.updateMany({ where: { userId: user.id }, data: { goals: [], availabilityNote: null } });
    await t.favoriteTeacher.deleteMany({ where: { student: { userId: user.id } } });
    await t.account.deleteMany({ where: { userId: user.id } });
    await t.session.deleteMany({ where: { userId: user.id } });
    await t.verificationToken.deleteMany({ where: { identifier: { endsWith: `:${user.id}` } } });
    await t.notification.deleteMany({ where: { userId: user.id } });
    await t.notificationPreference.deleteMany({ where: { userId: user.id } });
    await t.user.update({
      where: { id: user.id },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
        name: user.locale === "en" ? "Deleted user" : "Utilisateur supprimé",
        email: null,
        emailVerified: null,
        phone: null,
        phoneVerified: null,
        passwordHash: null,
        image: null,
        city: null,
      },
    });
    await t.auditLog.create({ data: { actorId: user.id, action: "ACCOUNT_DELETED", targetType: "User", targetId: user.id, meta: { role: user.role } } });
  });
  // Files are removed from storage after the database no longer points to them
  for (const d of docs) await deleteDocument(d.id);
}

/** Everything we hold about a person, for the "Download my data" button (portability). */
export async function exportData(user: User) {
  const [student, teacher, bookings, payments, payouts, ledger, sent, reviews, attempts, notifications] = await Promise.all([
    db.studentProfile.findUnique({ where: { userId: user.id }, include: { favorites: { include: { teacher: { select: { user: { select: { name: true } } } } } } } }),
    db.teacherProfile.findUnique({ where: { userId: user.id }, include: { availability: true, certificates: true, educations: true, application: { select: { status: true, submittedAt: true, decidedAt: true } } } }),
    db.booking.findMany({
      where: { OR: [{ student: { userId: user.id } }, { teacher: { userId: user.id } }] },
      orderBy: { startsAt: "desc" },
      include: { lesson: { select: { teacherNotes: true, homework: true, sharedNotes: true } }, student: { select: { user: { select: { name: true } } } }, teacher: { select: { user: { select: { name: true } } } } },
    }),
    db.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.payout.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.ledgerAccount.findMany({ where: { userId: user.id }, include: { lines: { include: { transaction: { select: { kind: true, createdAt: true, memo: true } } } } } }),
    db.message.findMany({ where: { senderId: user.id }, orderBy: { createdAt: "asc" }, select: { body: true, createdAt: true, conversationId: true } }),
    db.review.findMany({ where: { student: { userId: user.id } }, select: { rating: true, comment: true, createdAt: true } }),
    db.testAttempt.findMany({ where: { userId: user.id }, include: { answers: { select: { answerText: true, scorePct: true, feedback: true, correctedText: true } } } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);
  const { passwordHash: _ignored, ...account } = user;
  void _ignored;
  return {
    exportedAt: new Date().toISOString(),
    account,
    studentProfile: student,
    teacherProfile: teacher && { ...teacher, payoutPhone: teacher.payoutPhone },
    bookings: bookings.map((b) => ({
      id: b.id,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      type: b.type,
      status: b.status,
      priceXaf: b.priceXaf,
      student: b.student.user.name,
      teacher: b.teacher.user.name,
      lesson: b.lesson,
    })),
    payments,
    payouts,
    balances: ledger.map((a) => ({ type: a.type, balanceXaf: a.balanceXaf, movements: a.lines.map((l) => ({ amountXaf: l.amountXaf, kind: l.transaction.kind, at: l.transaction.createdAt, memo: l.transaction.memo })) })),
    messagesSent: sent,
    reviewsGiven: reviews,
    libraryAttempts: attempts,
    notifications,
  };
}

import "server-only";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { REVENUE, post } from "./ledger";
import { notify } from "./notify";

export const REFUND_CHOICES = [0, 50, 100] as const;
const DISPUTABLE = ["COMPLETED", "NO_SHOW_STUDENT", "CANCELLED_BY_STUDENT"] as const;

export type DisputeError = "not_allowed" | "window_closed" | "already_open" | "not_found" | "already_resolved";
export class DisputeFailure extends Error {
  constructor(public code: DisputeError) {
    super(code);
  }
}

/** What the teacher earned for this lesson (net) and the platform fee, from the ledger. */
export async function earnedFor(bookingId: string) {
  const tx = await db.ledgerTransaction.findUnique({
    where: { kind_referenceId: { kind: "LESSON_EARNED", referenceId: bookingId } },
    include: { lines: { include: { account: true } } },
  });
  if (!tx) return null;
  const net = tx.lines.find((l) => l.account.type === "TEACHER_PENDING")?.amountXaf ?? 0;
  const fee = tx.lines.find((l) => l.account.type === "PLATFORM_REVENUE")?.amountXaf ?? 0;
  return { net, fee, total: net + fee };
}

async function released(bookingId: string) {
  return Boolean(await db.ledgerTransaction.findUnique({ where: { kind_referenceId: { kind: "EARNINGS_RELEASED", referenceId: bookingId } } }));
}

/** Can the student still report a problem with this lesson? (Paid, finished, inside the 24-hour window.) */
export async function canDispute(b: { id: string; status: string; releaseAt: Date | null }, now = new Date()) {
  if (!DISPUTABLE.includes(b.status as (typeof DISPUTABLE)[number])) return false;
  if (!b.releaseAt || b.releaseAt <= now) return false;
  return Boolean(await earnedFor(b.id)) && !(await released(b.id));
}

const admins = () => db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });

export async function openDispute(user: User, bookingId: string, reason: string) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { student: true, teacher: { include: { user: true } }, dispute: true } });
  if (!b || b.student.userId !== user.id) throw new DisputeFailure("not_found");
  if (b.dispute) throw new DisputeFailure("already_open");
  if (!(await canDispute(b))) throw new DisputeFailure("window_closed");
  // The unique bookingId makes a second dispute for the same lesson impossible
  const d = await db.dispute.create({ data: { bookingId, openedById: user.id, reason } }).catch(() => {
    throw new DisputeFailure("already_open");
  });
  await db.auditLog.create({ data: { actorId: user.id, action: "DISPUTE_OPENED", targetType: "Dispute", targetId: d.id, meta: { bookingId } } });
  await notify(b.teacher.userId, {
    type: "DISPUTE_OPENED",
    title: { en: "A student reported a problem", fr: "Un élève a signalé un problème" },
    body: {
      en: `${user.name} reported a problem with a lesson. Your earnings for it are on hold until the team decides. You can give your side of the story.`,
      fr: `${user.name} a signalé un problème avec un cours. Vos gains pour ce cours sont bloqués jusqu'à la décision de l'équipe. Vous pouvez donner votre version.`,
    },
    link: "/teacher/lessons",
  });
  for (const a of await admins()) {
    await notify(a.id, { type: "DISPUTE_OPENED", title: { en: "New dispute", fr: "Nouveau litige" }, body: { en: `About a lesson with ${b.teacher.user.name}.`, fr: `Concernant un cours avec ${b.teacher.user.name}.` }, link: `/admin/disputes/${d.id}`, inApp: true });
  }
  return d;
}

export async function respondToDispute(user: User, disputeId: string, text: string) {
  const d = await db.dispute.findUnique({ where: { id: disputeId }, include: { booking: { include: { teacher: true } } } });
  if (!d || d.booking.teacher.userId !== user.id) throw new DisputeFailure("not_found");
  if (d.status !== "OPEN") throw new DisputeFailure("already_resolved");
  const r = await db.dispute.updateMany({ where: { id: d.id, status: "OPEN", teacherResponse: null }, data: { teacherResponse: text } });
  if (!r.count) throw new DisputeFailure("not_allowed");
}

/**
 * Admin decision. A refund returns that share of the price to the student's wallet, taken from
 * the teacher's pending earnings and the platform fee in the same proportion; the rest is
 * released to the teacher at once. Everything happens in one database transaction.
 */
export async function resolveDispute(admin: User, disputeId: string, refundPct: (typeof REFUND_CHOICES)[number], note: string) {
  const d = await db.dispute.findUnique({ where: { id: disputeId }, include: { booking: { include: { student: { include: { user: true } }, teacher: { include: { user: true } } } } } });
  if (!d) throw new DisputeFailure("not_found");
  const earned = await earnedFor(d.bookingId);
  if (!earned) throw new DisputeFailure("not_allowed");
  const b = d.booking;
  const teacherId = b.teacher.userId;
  const studentId = b.student.userId;
  const refundNet = Math.round((earned.net * refundPct) / 100);
  const refundFee = Math.round((earned.fee * refundPct) / 100);
  const keep = earned.net - refundNet;

  await db.$transaction(async (t) => {
    // Only the first decision counts, even if two admins click at the same time
    const claimed = await t.dispute.updateMany({
      where: { id: d.id, status: "OPEN" },
      data: { status: refundPct > 0 ? "RESOLVED_REFUND" : "RESOLVED_NO_REFUND", refundPct, resolution: note, resolvedById: admin.id, resolvedAt: new Date() },
    });
    if (!claimed.count) throw new DisputeFailure("already_resolved");
    if (refundPct > 0) {
      await post(t, {
        kind: "DISPUTE_REFUND",
        referenceId: b.id,
        memo: `${refundPct}%`,
        lines: [
          { account: { type: "TEACHER_PENDING", userId: teacherId }, amount: -refundNet },
          { account: REVENUE, amount: -refundFee },
          { account: { type: "STUDENT_WALLET", userId: studentId }, amount: refundNet + refundFee },
        ],
      });
    }
    if (keep > 0) {
      await post(t, {
        kind: "EARNINGS_RELEASED",
        referenceId: b.id,
        lines: [{ account: { type: "TEACHER_PENDING", userId: teacherId }, amount: -keep }, { account: { type: "TEACHER_AVAILABLE", userId: teacherId }, amount: keep }],
      });
    }
    await t.auditLog.create({ data: { actorId: admin.id, action: "DISPUTE_RESOLVED", targetType: "Dispute", targetId: d.id, meta: { refundPct, refundXaf: refundNet + refundFee, note } } });
  });

  const amount = refundNet + refundFee;
  const studentBody =
    refundPct > 0
      ? { en: `We refunded ${amount} FCFA to your wallet. ${note}`, fr: `Nous avons remboursé ${amount} FCFA sur votre portefeuille. ${note}` }
      : { en: `After checking the lesson, no refund was given. ${note}`, fr: `Après vérification du cours, aucun remboursement n'a été accordé. ${note}` };
  await notify(studentId, { type: "DISPUTE_RESOLVED", title: { en: "Your report was reviewed", fr: "Votre signalement a été examiné" }, body: studentBody, link: "/student/lessons" });
  await notify(teacherId, {
    type: "DISPUTE_RESOLVED",
    title: { en: "Dispute decided", fr: "Litige tranché" },
    body:
      refundPct === 100
        ? { en: `The student was refunded in full. ${note}`, fr: `L'élève a été remboursé en totalité. ${note}` }
        : refundPct === 50
          ? { en: `The student was refunded half; ${keep} FCFA is now available to you. ${note}`, fr: `L'élève a été remboursé à moitié ; ${keep} FCFA sont maintenant disponibles. ${note}` }
          : { en: `No refund: your ${keep} FCFA is now available. ${note}`, fr: `Pas de remboursement : vos ${keep} FCFA sont maintenant disponibles. ${note}` },
    link: "/teacher/earnings",
  });
}

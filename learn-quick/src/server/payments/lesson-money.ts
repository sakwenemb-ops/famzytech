import "server-only";
import type { Booking } from "@prisma/client";
import { db } from "@/lib/db";
import { ESCROW, post } from "../ledger";

/** Money for one lesson: refunds when cancelled in time, earnings when it happened. */

/** Was this lesson actually paid for (directly, or as part of a paid pack)? */
async function fundedAmount(b: Booking) {
  if (b.paymentId) {
    const pay = await db.payment.findUnique({ where: { id: b.paymentId } });
    if (pay?.status === "SUCCESSFUL") return b.priceXaf;
  }
  if (b.packageId) {
    const pack = await db.lessonPackage.findUnique({ where: { id: b.packageId } });
    if (pack?.paymentId) return b.priceXaf;
  }
  return 0;
}

/** Cancelled with a refund: the lesson price goes back to the student's wallet (pack lessons get their credit back instead). */
export async function refundCancelledLesson(b: Booking, studentUserId: string) {
  // Pack lessons (including the first one, bought with the pack) get their credit back instead of money
  if (b.packageId) return 0;
  const amount = await fundedAmount(b);
  if (!amount) return 0;
  await db.$transaction((t) =>
    post(t, { kind: "LESSON_REFUND", referenceId: b.id, lines: [{ account: ESCROW, amount: -amount }, { account: { type: "STUDENT_WALLET", userId: studentUserId }, amount }] }),
  );
  return amount;
}

/** The teacher has earned this lesson (it happened, or the student cancelled too late). */
export async function earnLesson(b: Booking, teacherUserId: string) {
  const amount = await fundedAmount(b);
  if (!amount) return;
  const fee = Math.round((amount * b.commissionPct) / 100);
  await db.$transaction((t) =>
    post(t, {
      kind: "LESSON_EARNED",
      referenceId: b.id,
      lines: [{ account: ESCROW, amount: -amount }, { account: { type: "TEACHER_PENDING", userId: teacherUserId }, amount: amount - fee }, { account: { type: "PLATFORM_REVENUE" }, amount: fee }],
    }),
  );
}


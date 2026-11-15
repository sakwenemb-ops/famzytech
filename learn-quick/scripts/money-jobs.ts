/**
 * Money jobs. Run every 5 minutes (for example with cron): npm run jobs:money
 * - re-checks Mobile Money payments still waiting (in case a webhook was lost)
 * - completes lessons that ended and moves their price to the teacher's pending earnings
 * - makes earnings available after the 24-hour dispute window
 * - checks withdrawals still being sent
 */
import { checkPendingPayments, settleLessons } from "@/server/payments/service";
import { checkPayouts } from "@/server/payments/payouts";
import { db } from "@/lib/db";

(async () => {
  const payments = await checkPendingPayments();
  const lessons = await settleLessons();
  const payouts = await checkPayouts();
  console.log(`Checked ${payments} payment(s); completed ${lessons.completed} lesson(s), released ${lessons.released}; checked ${payouts} payout(s).`);
})().finally(() => db.$disconnect());

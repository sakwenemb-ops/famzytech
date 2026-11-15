/**
 * Booking jobs. Run every 10 minutes (for example with cron): npm run jobs:bookings
 * - releases slots whose 15-minute payment hold ran out
 * - sends lesson reminders 24 hours and 1 hour before
 */
import { expireHolds, sendReminders } from "@/server/booking";
import { db } from "@/lib/db";

(async () => {
  const expired = await expireHolds();
  const reminders = await sendReminders();
  console.log(`Released ${expired} expired hold(s); sent ${reminders} reminder(s).`);
})().finally(() => db.$disconnect());

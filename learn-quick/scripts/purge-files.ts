/**
 * Daily clean-up (as promised in the privacy policy):
 * - deletes identity documents whose 90-day retention has ended;
 * - deletes security log entries older than one year.
 * Run once a day (e.g. a cron job): npm run jobs:purge-files
 */
import { purgeExpiredDocuments } from "@/server/files";
import { db } from "@/lib/db";

async function main() {
  const files = await purgeExpiredDocuments();
  const logs = await db.auditLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 365 * 86_400_000) } } });
  console.log(`Deleted ${files} expired file(s) and ${logs.count} old log entr${logs.count === 1 ? "y" : "ies"}.`);
}

main().finally(() => db.$disconnect());

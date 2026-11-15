/**
 * Deletes identity documents whose 90-day retention has ended.
 * Run once a day (e.g. a cron job): npm run jobs:purge-files
 */
import { purgeExpiredDocuments } from "@/server/files";
import { db } from "@/lib/db";

purgeExpiredDocuments()
  .then((n) => console.log(`Deleted ${n} expired file(s).`))
  .finally(() => db.$disconnect());

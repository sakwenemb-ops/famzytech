/**
 * Library job. Run every 5 minutes (for example with cron): npm run jobs:library
 * - retries AI corrections that failed (a basic score is shown meanwhile)
 * - submits and grades exams left open after their time ran out
 */
import { retryGrading } from "@/server/library/service";
import { db } from "@/lib/db";

retryGrading()
  .then((n) => console.log(`Processed ${n} attempt(s).`))
  .finally(() => db.$disconnect());

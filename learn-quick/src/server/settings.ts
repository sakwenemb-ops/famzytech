import "server-only";
import { db } from "@/lib/db";

const DEFAULTS = { commissionPct: 18, freeCancelHours: 12, slotHoldMinutes: 15, escrowReleaseHours: 24, minPayoutXaf: 5000, applicationReviewDays: 5, libraryAiGradesPerDay: 30 };
export type SettingKey = keyof typeof DEFAULTS;

/** Platform setting from the database, or its default. */
export async function getSetting<K extends SettingKey>(key: K): Promise<(typeof DEFAULTS)[K]> {
  const row = await db.platformSetting.findUnique({ where: { key } });
  return (row?.value as (typeof DEFAULTS)[K]) ?? DEFAULTS[key];
}

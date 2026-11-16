import { z } from "zod";

/** What admins may change in Admin → Settings, with safe limits. */
export const SETTING_RULES = {
  commissionPct: z.coerce.number().int().min(0).max(50),
  freeCancelHours: z.coerce.number().int().min(0).max(72),
  minBookingNoticeHours: z.coerce.number().int().min(0).max(72),
  slotHoldMinutes: z.coerce.number().int().min(5).max(60),
  paymentTimeoutMinutes: z.coerce.number().int().min(2).max(30),
  escrowReleaseHours: z.coerce.number().int().min(1).max(168),
  minPayoutXaf: z.coerce.number().int().min(500).max(1_000_000),
  payoutRequiresApproval: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  applicationReviewDays: z.coerce.number().int().min(1).max(30),
  libraryAiGradesPerDay: z.coerce.number().int().min(0).max(500),
} as const;
export type EditableSetting = keyof typeof SETTING_RULES;
export const SETTING_GROUPS: { id: string; keys: EditableSetting[] }[] = [
  { id: "lessons", keys: ["commissionPct", "freeCancelHours", "minBookingNoticeHours", "slotHoldMinutes"] },
  { id: "money", keys: ["paymentTimeoutMinutes", "escrowReleaseHours", "minPayoutXaf", "payoutRequiresApproval"] },
  { id: "other", keys: ["applicationReviewDays", "libraryAiGradesPerDay"] },
];

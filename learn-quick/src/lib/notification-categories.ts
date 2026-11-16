/** Notification types are grouped so people can choose which ones also arrive by email or SMS. */
export const CATEGORIES = ["lessons", "messages", "payments", "account"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Account notices (application decisions, security) are always sent. */
export const ALWAYS_SENT: Category[] = ["account"];

export function categoryOf(type: string): Category {
  if (type.startsWith("MESSAGE")) return "messages";
  if (/^(PAYMENT|PAYOUT|WALLET)/.test(type)) return "payments";
  if (/^(LESSON|BOOKING|PACKAGE|DISPUTE)/.test(type)) return "lessons";
  return "account";
}

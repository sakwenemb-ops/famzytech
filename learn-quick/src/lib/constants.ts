/** Fixed option lists. Labels live in the message files under the same keys. */
export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const LANGUAGES = ["ENGLISH", "FRENCH"] as const;
export const GOALS = ["CONVERSATION", "SCHOOL", "BUSINESS", "TRAVEL", "DELF_DALF", "TCF_TEF", "IELTS", "TOEFL", "TRANSLATION"] as const;
export const SPECIALTIES = ["CONVERSATION", "EXAM_PREP", "BUSINESS", "KIDS", "GRAMMAR", "PRONUNCIATION", "TRANSLATION"] as const;

/** Standard lesson length. Prices are per lesson of this length. */
export const LESSON_MINUTES = 50;

export type Level = (typeof LEVELS)[number];
export type LanguageCode = (typeof LANGUAGES)[number];

/** All IANA time zones the runtime knows, Africa first. */
export function timeZones(): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["Africa/Douala", "UTC"];
  return [...all.filter((z) => z.startsWith("Africa/")), ...all.filter((z) => !z.startsWith("Africa/"))];
}

"use client";

import { useTranslations } from "next-intl";

/** Translate an error key from a server action; unknown keys fall back to a generic message. */
export function useErrorText() {
  const t = useTranslations("errors");
  return (key?: string) => (key ? (t.has(key) ? t(key) : t("invalid")) : undefined);
}

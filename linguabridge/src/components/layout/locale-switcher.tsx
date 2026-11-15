"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const next = locale === "fr" ? "en" : "fr";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => router.replace(pathname, { locale: next }))}
      className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
      aria-label={`${t("language")}: ${next === "fr" ? "Français" : "English"}`}
      lang={next}
    >
      <Languages className="size-4" aria-hidden />
      {next === "fr" ? "FR" : "EN"}
    </button>
  );
}

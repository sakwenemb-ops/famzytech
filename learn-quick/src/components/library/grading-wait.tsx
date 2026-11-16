"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { attemptStatusAction } from "@/server/library-actions";

/** Shown while answers are being corrected; reloads the page when results are ready. */
export function GradingWait({ attemptId }: { attemptId: string }) {
  const t = useTranslations("library");
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(async () => {
      const status = await attemptStatusAction(attemptId);
      if (status && status !== "SUBMITTED") router.refresh();
    }, 2000);
    return () => clearInterval(id);
  }, [attemptId, router]);
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-8 text-center" role="status">
      <Loader2 className="mx-auto size-8 animate-spin text-primary" aria-hidden />
      <p className="mt-3 font-semibold">{t("grading")}</p>
      <p className="mt-1 text-sm text-muted">{t("gradingHint")}</p>
    </div>
  );
}

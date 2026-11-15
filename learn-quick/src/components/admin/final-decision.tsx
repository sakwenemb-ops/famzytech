"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { finishReviewAction, startReviewAction, type FinalDecision } from "@/server/review-actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function StartReviewButton({ applicationId }: { applicationId: string }) {
  const t = useTranslations("review");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button disabled={pending} onClick={() => start(async () => { await startReviewAction(applicationId); router.refresh(); })}>
      {t("start")}
    </Button>
  );
}

export function FinalDecisionPanel({ applicationId, suggestProfessional }: { applicationId: string; suggestProfessional: boolean }) {
  const t = useTranslations("review");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [professional, setProfessional] = useState(suggestProfessional);
  const [error, setError] = useState<string | null>(null);

  const finish = (d: FinalDecision) =>
    start(async () => {
      setError(null);
      const res = await finishReviewAction(applicationId, d, { professional });
      if (res?.error) setError(res.error);
      else router.refresh();
    });

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" checked={professional} onChange={(e) => setProfessional(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]" />
        <span>{t("professional")}</span>
      </label>
      {error && <Alert tone="danger">{t(`errors.${error}`)}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button disabled={pending} onClick={() => finish("APPROVE")}>{t("approve")}</Button>
        <Button variant="secondary" disabled={pending} onClick={() => finish("REQUEST_CHANGES")}>{t("requestChanges")}</Button>
        <Button variant="danger" disabled={pending} onClick={() => window.confirm(t("confirmReject")) && finish("REJECT")}>{t("reject")}</Button>
      </div>
    </div>
  );
}

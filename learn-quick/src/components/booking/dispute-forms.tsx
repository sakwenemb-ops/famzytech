"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { openDisputeAction, resolveDisputeAction, respondDisputeAction } from "@/server/dispute-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useKeepFormAction } from "@/components/ui/use-form-action";

const area = "block w-full rounded-[var(--radius-md)] border border-border bg-surface p-2.5 text-[15px] focus:border-primary focus:outline-none";

export function OpenDisputeForm({ bookingId, deadline }: { bookingId: string; deadline: string }) {
  const t = useTranslations("disputes");
  const [state, action, pending] = useActionState(openDisputeAction.bind(null, bookingId), undefined);
  if (state?.ok) return <Alert tone="success">{t("opened")}</Alert>;
  return (
    <details className="group rounded-[var(--radius-md)] border border-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        <AlertTriangle className="size-4" aria-hidden />
        {t("reportProblem")}
      </summary>
      <form action={action} className="space-y-2 border-t border-border p-3">
        <p className="text-[13px] text-muted">{t("openHint", { deadline })}</p>
        <label htmlFor={`reason-${bookingId}`} className="block text-sm font-medium">{t("whatHappened")}</label>
        <textarea id={`reason-${bookingId}`} name="reason" rows={3} minLength={10} maxLength={2000} required className={area} />
        {state?.error && <Alert tone="danger">{t(`errors.${state.error}`)}</Alert>}
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>{t("send")}</Button>
      </form>
    </details>
  );
}

export function RespondDisputeForm({ disputeId }: { disputeId: string }) {
  const t = useTranslations("disputes");
  const [state, action, pending] = useActionState(respondDisputeAction.bind(null, disputeId), undefined);
  if (state?.ok) return <Alert tone="success">{t("responseSent")}</Alert>;
  return (
    <form action={action} className="space-y-2">
      <label htmlFor={`resp-${disputeId}`} className="block text-sm font-medium">{t("yourSide")}</label>
      <textarea id={`resp-${disputeId}`} name="response" rows={3} minLength={10} maxLength={2000} required className={area} />
      {state?.error && <Alert tone="danger">{t(`errors.${state.error}`)}</Alert>}
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>{t("sendResponse")}</Button>
    </form>
  );
}

export function ResolveDisputeForm({ disputeId, amounts }: { disputeId: string; amounts: Record<0 | 50 | 100, string> }) {
  const t = useTranslations("disputes");
  const [state, onSubmit, pending] = useKeepFormAction(resolveDisputeAction.bind(null, disputeId), undefined);
  if (state?.ok) return <Alert tone="success">{t("resolved")}</Alert>;
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">{t("decision")}</legend>
        {([100, 50, 0] as const).map((p) => (
          <label key={p} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
            <input type="radio" name="refundPct" value={p} className="size-4 accent-[var(--color-primary)]" />
            <span>{t(`refund${p}`, { amount: amounts[p] })}</span>
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-medium">{t("noteLabel")}</label>
        <textarea id="note" name="note" rows={3} minLength={10} maxLength={2000} className={area} />
        <p className="mt-1 text-xs text-muted">{t("noteHint")}</p>
      </div>
      {state?.error && <Alert tone="danger">{t(`errors.${state.error}`)}</Alert>}
      <Button type="submit" disabled={pending}>{t("confirmDecision")}</Button>
    </form>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { requestPayoutAction } from "@/server/payment-actions";
import { useKeepFormAction } from "@/components/ui/use-form-action";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { useErrorText } from "@/components/auth/use-error";

/**
 * Stays on the page even when there is nothing left to withdraw, so the confirmation
 * message is still visible after a successful request.
 */
export function PayoutForm({ max, defaultPhone, minHint, emptyText }: { max: number; defaultPhone: string | null; minHint?: string; emptyText?: string }) {
  const t = useTranslations("money");
  const err = useErrorText();
  // Keeps the typed amount and number after an error (e.g. a wrong password)
  const [state, onSubmit, pending] = useKeepFormAction(requestPayoutAction, undefined);
  const e = state?.errors ?? {};
  const success = state?.ok && state.message ? <Alert tone="success">{t(state.message as "payout_sent")}</Alert> : null;
  if (emptyText) {
    return (
      <div className="space-y-3">
        {success}
        <p className="text-sm text-muted">{emptyText}</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {success}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="amount" label={t("amount")} hint={minHint} error={err(e.amount)}>
          {(a) => <Input {...a} name="amount" inputMode="numeric" defaultValue={max || ""} />}
        </Field>
        <Field id="payout-phone" label={t("phone")} error={err(e.phone)}>
          {(a) => <Input {...a} name="phone" type="tel" inputMode="tel" defaultValue={defaultPhone ?? ""} />}
        </Field>
      </div>
      <Field id="payout-password" label={t("password")} hint={t("passwordHint")} error={err(e.password)}>
        {(a) => <Input {...a} name="password" type="password" autoComplete="current-password" className="sm:max-w-xs" />}
      </Field>
      <SubmitButton pending={pending} className="sm:w-auto">{t("withdrawButton")}</SubmitButton>
    </form>
  );
}

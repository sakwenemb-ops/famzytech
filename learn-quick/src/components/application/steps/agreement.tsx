"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { submitApplicationAction } from "@/server/application-actions";
import { Link } from "@/i18n/navigation";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { useErrorText } from "@/components/auth/use-error";
import { FieldError } from "../step-buttons";

export function AgreementStep({ missing, resubmission }: { missing: { slug: string; title: string }[]; resubmission: boolean }) {
  const t = useTranslations("application.agreement");
  const err = useErrorText();
  const [state, action] = useActionState(submitApplicationAction, undefined);
  const e = state?.errors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      <p className="text-sm text-muted">{t("intro")}</p>
      {missing.length > 0 && (
        <Alert tone="warning">
          <p className="font-medium">{t("missing")}</p>
          <ul className="mt-1 list-inside list-disc">
            {missing.map((m) => (
              <li key={m.slug}><Link href={`/teacher/application/${m.slug}`} className="underline">{m.title}</Link></li>
            ))}
          </ul>
        </Alert>
      )}
      {state?.message && <Alert tone="danger">{err(state.message)}</Alert>}
      <div className="space-y-3">
        {(["acceptTerms", "acceptConduct", "acceptPayouts"] as const).map((k) => (
          <div key={k}>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name={k} className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]" />
              <span>{t(k)}</span>
            </label>
            <FieldError message={err(e[k])} />
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-5">
        <SubmitButton disabled={missing.length > 0} className="sm:w-auto">{resubmission ? t("resubmit") : t("submit")}</SubmitButton>
        <p className="mt-2 text-[13px] text-muted">{t("reviewTime")}</p>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { savePricingAction } from "@/server/application-actions";
import { useKeepFormAction } from "@/components/ui/use-form-action";
import { Field, Input } from "@/components/ui/input";
import { useErrorText } from "@/components/auth/use-error";
import { formatXaf } from "@/lib/utils";
import { StepButtons } from "../step-buttons";

type Prices = { hourlyRateXaf: number | null; trialRateXaf: number | null; package5Discount: number; package10Discount: number; package20Discount: number };

export function PricingStep({ defaults, commissionPct, lessonMinutes, limits }: { defaults: Prices; commissionPct: number; lessonMinutes: number; limits: { min: number; max: number } }) {
  const t = useTranslations("application.pricing");
  const locale = useLocale() as "en" | "fr";
  const err = useErrorText();
  const [state, onSubmit, pending] = useKeepFormAction(savePricingAction, undefined);
  const [rate, setRate] = useState(defaults.hourlyRateXaf?.toString() ?? "");
  const e = state?.errors ?? {};
  const n = Number(rate);
  const net = Number.isInteger(n) && n > 0 ? Math.round(n * (1 - commissionPct / 100)) : null;

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="hourlyRateXaf" label={t("rate")} hint={t("rateHint", { minutes: lessonMinutes, min: formatXaf(limits.min, locale), max: formatXaf(limits.max, locale) })} error={err(e.hourlyRateXaf)}>
          {(a) => <Input {...a} name="hourlyRateXaf" inputMode="numeric" value={rate} onChange={(ev) => setRate(ev.target.value.replace(/\D/g, ""))} />}
        </Field>
        <Field id="trialRateXaf" label={t("trial")} hint={t("trialHint")} error={err(e.trialRateXaf)}>
          {(a) => <Input {...a} name="trialRateXaf" inputMode="numeric" defaultValue={defaults.trialRateXaf ?? ""} />}
        </Field>
      </div>
      {net !== null && (
        <p className="rounded-[var(--radius-md)] bg-success-soft px-4 py-3 text-sm text-success" aria-live="polite">
          {t("youReceive", { amount: formatXaf(net, locale), pct: commissionPct })}
        </p>
      )}
      <fieldset>
        <legend className="font-medium">{t("packages")}</legend>
        <p className="mb-3 mt-0.5 text-[13px] text-muted">{t("packagesHint")}</p>
        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          {(["package5", "package10", "package20"] as const).map((k) => (
            <Field key={k} id={`${k}Discount`} label={`${t(k)} (%)`} error={err(e[`${k}Discount`])}>
              {(a) => <Input {...a} name={`${k}Discount`} inputMode="numeric" maxLength={2} defaultValue={defaults[`${k}Discount`] || ""} placeholder="0" />}
            </Field>
          ))}
        </div>
      </fieldset>
      <StepButtons pending={pending} state={state} />
    </form>
  );
}

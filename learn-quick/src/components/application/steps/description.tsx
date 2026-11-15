"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { saveDescriptionAction } from "@/server/application-actions";
import { useKeepFormAction } from "@/components/ui/use-form-action";
import { Choice } from "@/components/ui/choice";
import { Field, Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { useErrorText } from "@/components/auth/use-error";
import { SPECIALTIES } from "@/lib/constants";
import { FieldError, StepButtons } from "../step-buttons";

type Texts = { headlineEn: string; headlineFr: string; bioEn: string; bioFr: string; experienceEn: string; experienceFr: string };
type Limits = { headlineMin: number; headlineMax: number; bioMin: number; bioMax: number; experienceMax: number };

export function DescriptionStep({ defaults, specialties, limits: L }: { defaults: Texts; specialties: string[]; limits: Limits }) {
  const t = useTranslations("application.desc");
  const to = useTranslations("options");
  const err = useErrorText();
  const [state, onSubmit, pending] = useKeepFormAction(saveDescriptionAction, undefined);
  const [texts, setTexts] = useState(defaults);
  const e = state?.errors ?? {};

  const counter = (k: keyof Texts, max: number) => (
    <span className="float-right text-xs font-normal text-muted tabular-nums">{t("chars", { count: texts[k].length, max })}</span>
  );
  const text = (k: keyof Texts, max: number, multiline: boolean, hint?: string) => (
    <Field id={k} label={t(k)} hint={hint} error={err(e[k])}>
      {(a) =>
        multiline ? (
          <div>
            <Textarea {...a} name={k} rows={k.startsWith("bio") ? 6 : 3} maxLength={max} value={texts[k]} onChange={(ev) => setTexts({ ...texts, [k]: ev.target.value })} />
            {counter(k, max)}
          </div>
        ) : (
          <Input {...a} name={k} maxLength={max} value={texts[k]} onChange={(ev) => setTexts({ ...texts, [k]: ev.target.value })} />
        )
      }
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Alert tone="info">{t("noContact")}</Alert>
      <div className="grid gap-5 lg:grid-cols-2">
        {text("headlineEn", L.headlineMax, false, t("headlineHint", { min: L.headlineMin, max: L.headlineMax }))}
        {text("headlineFr", L.headlineMax, false, t("headlineHint", { min: L.headlineMin, max: L.headlineMax }))}
        {text("bioEn", L.bioMax, true, t("bioHint", { min: L.bioMin }))}
        {text("bioFr", L.bioMax, true, t("bioHint", { min: L.bioMin }))}
        {text("experienceEn", L.experienceMax, true)}
        {text("experienceFr", L.experienceMax, true)}
      </div>
      <fieldset>
        <legend className="mb-2 font-medium">{t("specialties")}</legend>
        <div className="flex flex-wrap gap-2">
          {SPECIALTIES.map((s) => (
            <Choice key={s} variant="chip" name="specialties" value={s} defaultChecked={specialties.includes(s)}>
              {to(`specialties.${s}`)}
            </Choice>
          ))}
        </div>
        <FieldError message={err(e.specialties)} />
      </fieldset>
      <StepButtons pending={pending} state={state} />
    </form>
  );
}

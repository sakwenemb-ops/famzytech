"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { saveAboutAction } from "@/server/application-actions";
import { useKeepFormAction } from "@/components/ui/use-form-action";
import { Choice } from "@/components/ui/choice";
import { Field, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/components/auth/use-error";
import { COUNTRIES } from "@/lib/countries";
import { LANGUAGES, LEVELS } from "@/lib/constants";
import { FieldError, StepButtons } from "../step-buttons";

type Row = { language: string; level: string };

export function AboutStep({ defaults }: { defaults: { subjects: string[]; spoken: Row[]; countryOfBirth: string | null } }) {
  const t = useTranslations("application.about");
  const to = useTranslations("options");
  const locale = useLocale() as "en" | "fr";
  const err = useErrorText();
  const [state, onSubmit, pending] = useKeepFormAction(saveAboutAction, undefined);
  const [rows, setRows] = useState<Row[]>(defaults.spoken.length ? defaults.spoken : [{ language: "", level: "" }]);
  const e = state?.errors ?? {};

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const known = (l: string) => (LANGUAGES as readonly string[]).includes(l);

  return (
    <form onSubmit={onSubmit} className="space-y-7" noValidate>
      <fieldset>
        <legend className="mb-2 font-medium">{t("subjects")}</legend>
        <div className="grid grid-cols-2 gap-3">
          {LANGUAGES.map((l) => (
            <Choice key={l} name="subjects" value={l} defaultChecked={defaults.subjects.includes(l)}>
              <span className="font-medium">{to(`languages.${l}`)}</span>
            </Choice>
          ))}
        </div>
        <FieldError message={err(e.subjects)} />
      </fieldset>

      <fieldset>
        <legend className="font-medium">{t("spoken")}</legend>
        <p className="mb-3 mt-0.5 text-[13px] text-muted">{t("spokenHint")}</p>
        <input type="hidden" name="spoken" value={JSON.stringify(rows.filter((r) => r.language.trim() && r.level).map((r) => ({ ...r, language: r.language.trim() })))} />
        <ul className="space-y-2">
          {rows.map((row, i) => {
            const isOther = row.language !== "" && !known(row.language);
            return (
              <li key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <div className="col-span-2 flex gap-2 sm:col-span-1">
                  <Select
                    aria-label={t("language")}
                    value={isOther ? "OTHER" : row.language}
                    onChange={(ev) => update(i, { language: ev.target.value === "OTHER" ? " " : ev.target.value })}
                  >
                    <option value="">{t("language")}…</option>
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>{to(`languages.${l}`)}</option>
                    ))}
                    <option value="OTHER">{t("otherLanguage")}</option>
                  </Select>
                  {isOther && (
                    <Input
                      aria-label={t("otherLanguage")}
                      placeholder={t("otherLanguagePlaceholder")}
                      value={row.language.trimStart()}
                      onChange={(ev) => update(i, { language: ev.target.value || " " })}
                      maxLength={40}
                    />
                  )}
                </div>
                <Select aria-label={t("level")} value={row.level} onChange={(ev) => update(i, { level: ev.target.value })}>
                  <option value="">{t("level")}…</option>
                  <option value="NATIVE">{t("native")}</option>
                  {LEVELS.map((lv) => (
                    <option key={lv} value={lv}>{to(`levels.${lv}.name`)}</option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t("remove")}
                  className="px-3"
                  disabled={rows.length === 1}
                  onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
        <Button type="button" variant="link" className="mt-2 text-sm" onClick={() => setRows((r) => [...r, { language: "", level: "" }])} disabled={rows.length >= 8}>
          <Plus className="size-4" aria-hidden />
          {t("add")}
        </Button>
        <FieldError message={err(e.spoken)} />
      </fieldset>

      <Field id="countryOfBirth" label={t("countryOfBirth")} error={err(e.countryOfBirth)}>
        {(a) => (
          <Select {...a} name="countryOfBirth" defaultValue={defaults.countryOfBirth ?? "CM"} className="sm:max-w-xs">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name[locale]}</option>
            ))}
            <option value="OTHER">{t("otherCountry")}</option>
          </Select>
        )}
      </Field>

      <StepButtons pending={pending} state={state} />
    </form>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useKeepFormAction } from "@/components/ui/use-form-action";
import { saveLearningAction } from "@/server/profile-actions";
import { GOALS, LANGUAGES, LEVELS, type LanguageCode, type Level } from "@/lib/constants";
import { Choice } from "@/components/ui/choice";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import { SubmitButton } from "@/components/auth/submit-button";
import { useErrorText } from "@/components/auth/use-error";

export type LearningDefaults = {
  learningLanguages: LanguageCode[];
  englishLevel: Level | null;
  frenchLevel: Level | null;
  goals: string[];
  availabilityNote: string | null;
};

export function LearningForm({ defaults, mode }: { defaults: LearningDefaults; mode: "welcome" | "settings" }) {
  const t = useTranslations("learning");
  const to = useTranslations("options");
  const ts = useTranslations("settings");
  const err = useErrorText();
  const [state, onSubmit, pending] = useKeepFormAction(saveLearningAction, undefined);
  const [langs, setLangs] = useState<LanguageCode[]>(defaults.learningLanguages);
  const e = state?.errors ?? {};

  const toggle = (l: LanguageCode) => setLangs((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));

  return (
    <form onSubmit={onSubmit} className="space-y-7" noValidate>
      {mode === "welcome" && <input type="hidden" name="next" value="dashboard" />}
      {state?.ok && <Alert tone="success">{ts("saved")}</Alert>}

      <fieldset>
        <legend className="mb-2 font-medium">{t("languagesLabel")}</legend>
        <div className="grid grid-cols-2 gap-3">
          {LANGUAGES.map((l) => (
            <Choice key={l} name="learningLanguages" value={l} checked={langs.includes(l)} onChange={() => toggle(l)}>
              <span className="font-medium">{to(`languages.${l}`)}</span>
            </Choice>
          ))}
        </div>
        {e.learningLanguages && <p className="mt-1.5 text-[13px] text-danger" role="alert">{err(e.learningLanguages)}</p>}
      </fieldset>

      {LANGUAGES.filter((l) => langs.includes(l)).map((l) => {
        const field = l === "ENGLISH" ? "englishLevel" : "frenchLevel";
        const current = l === "ENGLISH" ? defaults.englishLevel : defaults.frenchLevel;
        return (
          <fieldset key={l}>
            <legend className="font-medium">{t("levelLabel", { language: to(`languages.${l}`).toLowerCase() })}</legend>
            <p className="mb-2 mt-0.5 text-[13px] text-muted">{t("levelHint")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {LEVELS.map((lv) => (
                <Choice key={lv} type="radio" name={field} value={lv} defaultChecked={current === lv}>
                  <span>
                    <span className="block text-sm font-medium">{to(`levels.${lv}.name`)}</span>
                    <span className="block text-[13px] text-muted">{to(`levels.${lv}.can`)}</span>
                  </span>
                </Choice>
              ))}
            </div>
            {e[field] && <p className="mt-1.5 text-[13px] text-danger" role="alert">{err(e[field])}</p>}
          </fieldset>
        );
      })}

      <fieldset>
        <legend className="font-medium">{t("goalsLabel")}</legend>
        <p className="mb-2 mt-0.5 text-[13px] text-muted">{t("goalsHint")}</p>
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <Choice key={g} variant="chip" name="goals" value={g} defaultChecked={defaults.goals.includes(g)}>
              {to(`goals.${g}`)}
            </Choice>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="availabilityNote" className="block font-medium">{t("availabilityLabel")}</label>
        <Textarea
          id="availabilityNote"
          name="availabilityNote"
          maxLength={300}
          rows={2}
          defaultValue={defaults.availabilityNote ?? ""}
          placeholder={t("availabilityPlaceholder")}
        />
      </div>

      <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-end">
        {mode === "welcome" && (
          <Link href="/student" className="text-sm text-muted hover:text-fg">{t("skip")}</Link>
        )}
        <SubmitButton pending={pending} className="sm:w-auto">{mode === "welcome" ? t("saveContinue") : t("save")}</SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useLocale, useTranslations } from "next-intl";
import { useKeepFormAction } from "@/components/ui/use-form-action";
import { saveAccountAction } from "@/server/profile-actions";
import { COUNTRIES } from "@/lib/countries";
import { Field, Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { useErrorText } from "@/components/auth/use-error";

export function AccountForm({
  defaults,
  timeZones,
}: {
  defaults: { name: string; country: string; city: string | null; timeZone: string; locale: "en" | "fr" };
  timeZones: string[];
}) {
  const t = useTranslations("settings");
  const ta = useTranslations("auth");
  const locale = useLocale() as "en" | "fr";
  const err = useErrorText();
  const [state, onSubmit, pending] = useKeepFormAction(saveAccountAction, undefined);
  const e = state?.errors ?? {};
  const zones = timeZones.includes(defaults.timeZone) ? timeZones : [defaults.timeZone, ...timeZones];

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {state?.ok && <Alert tone="success">{t("saved")}</Alert>}
      <Field id="name" label={ta("name")} hint={t("accountHint")} error={err(e.name)}>
        {(a) => <Input {...a} name="name" defaultValue={defaults.name} autoComplete="name" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="country" label={ta("country")} error={err(e.country)}>
          {(a) => (
            <Select {...a} name="country" defaultValue={defaults.country}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name[locale]}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="city" label={ta("city")} optionalLabel={ta("optional")} error={err(e.city)}>
          {(a) => <Input {...a} name="city" defaultValue={defaults.city ?? ""} />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="timeZone" label={t("timeZone")} hint={t("timeZoneHint")} error={err(e.timeZone)}>
          {(a) => (
            <Select {...a} name="timeZone" defaultValue={defaults.timeZone}>
              {zones.map((z) => (
                <option key={z} value={z}>{z.replaceAll("_", " ")}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="locale" label={t("interfaceLanguage")}>
          {(a) => (
            <Select {...a} name="locale" defaultValue={defaults.locale}>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </Select>
          )}
        </Field>
      </div>
      <SubmitButton pending={pending} className="sm:w-auto">{t("saveChanges")}</SubmitButton>
    </form>
  );
}

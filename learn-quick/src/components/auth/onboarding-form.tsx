"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { onboardingAction } from "@/server/auth-actions";
import { Field, Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { COUNTRIES } from "@/lib/countries";
import { SubmitButton } from "./submit-button";
import { useErrorText } from "./use-error";

export function OnboardingForm() {
  const t = useTranslations("auth");
  const locale = useLocale() as "en" | "fr";
  const err = useErrorText();
  const [state, action] = useActionState(onboardingAction, undefined);
  const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [timeZone, setTimeZone] = useState("Africa/Douala");
  const e = state?.errors ?? {};
  const v = state?.values ?? {};

  useEffect(() => {
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Douala");
    } catch {}
  }, []);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.message && <Alert tone="danger">{err(state.message)}</Alert>}
      <input type="hidden" name="timeZone" value={timeZone} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("iAm")}</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["STUDENT", "TEACHER"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "cursor-pointer rounded-[var(--radius-md)] border p-3 font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                role === value ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2",
              )}
            >
              <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="sr-only" />
              {value === "STUDENT" ? t("roleStudent") : t("roleTeacher")}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="phone" label={t("phone")} hint={t("phoneHint")} optionalLabel={t("optional")} error={err(e.phone)}>
        {(a) => <Input {...a} name="phone" defaultValue={v.phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="+237 6XX XX XX XX" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="country" label={t("country")}>
          {(a) => (
            <Select {...a} name="country" defaultValue={v.country ?? "CM"}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name[locale]}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="city" label={t("city")} optionalLabel={t("optional")}>
          {(a) => <Input {...a} name="city" defaultValue={v.city} />}
        </Field>
      </div>
      {role === "TEACHER" && <Alert tone="info">{t("teacherNote")}</Alert>}
      <SubmitButton>{t("continue")}</SubmitButton>
    </form>
  );
}

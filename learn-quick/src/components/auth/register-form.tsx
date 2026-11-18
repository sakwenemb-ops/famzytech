"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { GraduationCap, Presentation } from "lucide-react";
import { registerAction } from "@/server/auth-actions";
import { Field, Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { COUNTRIES } from "@/lib/countries";
import { SubmitButton } from "./submit-button";
import { useErrorText } from "./use-error";

export function RegisterForm({ defaultRole = "STUDENT" }: { defaultRole?: "STUDENT" | "TEACHER" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const err = useErrorText();
  const [state, action] = useActionState(registerAction, undefined);
  const [role, setRole] = useState(defaultRole);
  const [timeZone, setTimeZone] = useState("Africa/Douala");
  const e = state?.errors ?? {};
  const v = state?.values ?? {};

  useEffect(() => {
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Douala");
    } catch {}
  }, []);

  const roles = [
    { value: "STUDENT", label: t("roleStudent"), hint: t("roleStudentHint"), icon: GraduationCap },
    { value: "TEACHER", label: t("roleTeacher"), hint: t("roleTeacherHint"), icon: Presentation },
  ] as const;

  return (
    <form action={action} className="space-y-5" noValidate>
      {e.form && <Alert tone="danger">{err(e.form)}</Alert>}
      <input type="hidden" name="timeZone" value={timeZone} />
      <input type="hidden" name="locale" value={locale} />

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("iAm")}</legend>
        <div className="grid grid-cols-2 gap-3">
          {roles.map(({ value, label, hint, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-[var(--radius-md)] border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                role === value ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2",
              )}
            >
              <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="sr-only" />
              <Icon className={cn("size-5", role === value ? "text-primary" : "text-muted")} aria-hidden />
              <span className="font-medium">{label}</span>
              <span className="text-xs text-muted">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field id="name" label={t("name")} error={err(e.name)}>
        {(a) => <Input {...a} name="name" defaultValue={v.name} autoComplete="name" required />}
      </Field>
      <Field id="phone" label={t("phone")} hint={t("phoneHint")} error={err(e.phone)}>
        {(a) => <Input {...a} name="phone" defaultValue={v.phone} type="tel" autoComplete="tel" inputMode="tel" placeholder="+237 6XX XX XX XX" />}
      </Field>
      <Field id="email" label={t("email")} hint={t("emailOrPhoneHint")} error={err(e.email)}>
        {(a) => <Input {...a} name="email" defaultValue={v.email} type="email" autoComplete="email" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="country" label={t("country")} error={err(e.country)}>
          {(a) => (
            <Select {...a} name="country" defaultValue={v.country ?? "CM"}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name[locale as "en" | "fr"]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="city" label={t("city")} optionalLabel={t("optional")} error={err(e.city)}>
          {(a) => <Input {...a} name="city" defaultValue={v.city} autoComplete="address-level2" />}
        </Field>
      </div>
      <Field id="password" label={t("password")} hint={t("passwordHint")} error={err(e.password)}>
        {(a) => <Input {...a} name="password" type="password" autoComplete="new-password" required />}
      </Field>

      {role === "TEACHER" && <Alert tone="info">{t("teacherNote")}</Alert>}

      <div>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 accent-[var(--color-primary)]" aria-invalid={e.acceptTerms ? true : undefined} />
          <span>
            {t.rich("acceptTerms", {
              terms: (c) => <a href={`/${locale}/terms`} target="_blank" rel="noopener" className="text-primary underline">{c}</a>,
              privacy: (c) => <a href={`/${locale}/privacy`} target="_blank" rel="noopener" className="text-primary underline">{c}</a>,
            })}
          </span>
        </label>
        {e.acceptTerms && <p className="mt-1 text-[13px] text-danger" role="alert">{err(e.acceptTerms)}</p>}
      </div>

      <SubmitButton>{t("registerButton")}</SubmitButton>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction } from "@/server/auth-actions";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "./submit-button";
import { useErrorText } from "./use-error";

export function LoginForm() {
  const t = useTranslations("auth");
  const err = useErrorText();
  const [state, action] = useActionState(loginAction, undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.message && <Alert tone="danger">{err(state.message)}</Alert>}
      <Field id="identifier" label={t("identifier")}>
        {(a) => <Input {...a} name="identifier" defaultValue={state?.values?.identifier} autoComplete="username" required inputMode="email" />}
      </Field>
      <Field id="password" label={t("password")}>
        {(a) => <Input {...a} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <SubmitButton>{t("loginButton")}</SubmitButton>
    </form>
  );
}

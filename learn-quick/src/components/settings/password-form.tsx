"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { changePasswordAction } from "@/server/profile-actions";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { useErrorText } from "@/components/auth/use-error";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("settings");
  const ta = useTranslations("auth");
  const err = useErrorText();
  const [state, action] = useActionState(changePasswordAction, undefined);
  const e = state?.errors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.ok && <Alert tone="success">{t("password_changed")}</Alert>}
      {!hasPassword && <p className="text-sm text-muted">{t("setPasswordHint")}</p>}
      {hasPassword && (
        <Field id="currentPassword" label={t("currentPassword")} error={err(e.currentPassword)}>
          {(a) => <Input {...a} name="currentPassword" type="password" autoComplete="current-password" />}
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="newPassword" label={t("newPassword")} hint={ta("passwordHint")} error={err(e.newPassword)}>
          {(a) => <Input {...a} name="newPassword" type="password" autoComplete="new-password" />}
        </Field>
        <Field id="confirmPassword" label={t("confirmPassword")} error={err(e.confirmPassword)}>
          {(a) => <Input {...a} name="confirmPassword" type="password" autoComplete="new-password" />}
        </Field>
      </div>
      <SubmitButton variant="secondary" className="sm:w-auto">{t("changePassword")}</SubmitButton>
    </form>
  );
}

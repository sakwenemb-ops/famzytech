"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deleteAccountAction } from "@/server/account-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function DeleteAccount({ blockers, hasPassword }: { blockers: string[]; hasPassword: boolean }) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(deleteAccountAction, undefined);
  if (blockers.length) {
    return (
      <div className="space-y-2 text-sm">
        <p>{t("blockedIntro")}</p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          {blockers.map((b) => <li key={b}>{t(`blockers.${b}`)}</li>)}
        </ul>
      </div>
    );
  }
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm font-medium text-danger [&::-webkit-details-marker]:hidden">{t("deleteOpen")}</summary>
      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm(t("confirmDialog"))) e.preventDefault();
        }}
        className="mt-3 space-y-3"
      >
        <Alert tone="warning">{t("deleteWarning")}</Alert>
        {hasPassword ? (
          <Field id="delete-password" label={t("password")}>
            {(a) => <Input {...a} name="password" type="password" autoComplete="current-password" required />}
          </Field>
        ) : (
          <Field id="delete-confirm" label={t("typeDelete")}>
            {(a) => <Input {...a} name="confirm" autoComplete="off" required />}
          </Field>
        )}
        {state?.error && <Alert tone="danger">{t(`errors.${["wrong_password", "confirm_required", "blocked"].includes(state.error) ? state.error : "other"}`)}</Alert>}
        <Button type="submit" variant="danger" disabled={pending}>{t("deleteButton")}</Button>
      </form>
    </details>
  );
}

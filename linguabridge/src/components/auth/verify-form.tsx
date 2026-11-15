"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resendCodeAction, verifyAction } from "@/server/auth-actions";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "./submit-button";
import { useErrorText } from "./use-error";

export function VerifyForm({ channel }: { channel: "email" | "phone" }) {
  const t = useTranslations("auth");
  const err = useErrorText();
  const [state, action] = useActionState(verifyAction, undefined);
  const [resend, resendAction, resending] = useActionState(resendCodeAction, undefined);

  return (
    <div className="space-y-4">
      {resend?.message && <Alert tone={resend.ok ? "success" : "warning"}>{err(resend.message)}</Alert>}
      {state?.message && <Alert tone="danger">{err(state.message)}</Alert>}
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="channel" value={channel} />
        <Field id="code" label={t("code")} error={err(state?.errors?.code)}>
          {(a) => (
            <Input
              {...a}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              className="text-center font-mono text-xl tracking-[0.5em]"
              autoFocus
            />
          )}
        </Field>
        <SubmitButton>{t("verifyButton")}</SubmitButton>
      </form>
      <form action={resendAction}>
        <input type="hidden" name="channel" value={channel} />
        <Button variant="link" disabled={resending} className="text-sm">
          {t("resend")}
        </Button>
      </form>
    </div>
  );
}

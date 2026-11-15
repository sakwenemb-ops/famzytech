"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useErrorText } from "@/components/auth/use-error";
import type { FormState } from "@/server/auth-actions";

/** "Save" and "Save and continue" for wizard steps, plus the saved / error message. */
export function StepButtons({ pending, state, last = false }: { pending: boolean; state: FormState; last?: boolean }) {
  const t = useTranslations("application");
  const err = useErrorText();
  return (
    <div className="space-y-3 border-t border-border pt-5">
      {state?.ok && <Alert tone="success">{t("saved")}</Alert>}
      {state?.message && !state.ok && <Alert tone="danger">{err(state.message)}</Alert>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {t("save")}
        </Button>
        {!last && (
          <Button type="submit" name="continue" value="1" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("saveContinue")}
          </Button>
        )}
      </div>
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-[13px] text-danger" role="alert">
      {message}
    </p>
  );
}

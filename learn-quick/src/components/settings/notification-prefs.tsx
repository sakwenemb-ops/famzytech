"use client";

import { useTranslations } from "next-intl";
import { useKeepFormAction } from "@/components/ui/use-form-action";
import { savePreferencesAction } from "@/server/notification-actions";
import { CATEGORIES, ALWAYS_SENT, type Category } from "@/lib/notification-categories";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/auth/submit-button";

export function NotificationPrefs({ enabled, via }: { enabled: Record<Category, boolean>; via: "email" | "sms" }) {
  const t = useTranslations("notifications");
  const [state, onSubmit, pending] = useKeepFormAction(savePreferencesAction, undefined);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {state?.ok && <Alert tone="success">{t("prefsSaved")}</Alert>}
      <p className="text-sm text-muted">{t("prefsHint", { via })}</p>
      {CATEGORIES.map((c) => {
        const locked = ALWAYS_SENT.includes(c);
        return (
          <label key={c} className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border p-3">
            <input type="checkbox" name={c} defaultChecked={locked || enabled[c]} disabled={locked} className="mt-1 size-4 accent-[var(--color-primary)]" />
            <span>
              <span className="block text-sm font-medium">{t(`categories.${c}`)}</span>
              <span className="block text-xs text-muted">{locked ? t("alwaysSent") : t(`categoryHints.${c}`)}</span>
            </span>
          </label>
        );
      })}
      <SubmitButton pending={pending} block={false}>{t("savePrefs")}</SubmitButton>
    </form>
  );
}

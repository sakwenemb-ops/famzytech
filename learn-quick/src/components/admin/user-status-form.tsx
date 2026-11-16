"use client";

import { useTranslations } from "next-intl";
import { setUserStatusAction } from "@/server/admin-actions";
import { useKeepFormAction } from "@/components/ui/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function UserStatusForm({ userId, status, upcoming }: { userId: string; status: "ACTIVE" | "SUSPENDED"; upcoming: number }) {
  const t = useTranslations("adminUsers");
  const [state, onSubmit, pending] = useKeepFormAction(setUserStatusAction.bind(null, userId), undefined);
  const next = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  return (
    <form
      onSubmit={(e) => {
        if (next === "SUSPENDED" && !window.confirm(t("confirmSuspend", { count: upcoming }))) return e.preventDefault();
        onSubmit(e);
      }}
      className="space-y-3"
    >
      {state?.ok && <Alert tone="success">{t(next === "SUSPENDED" ? "reactivated" : "suspended", { count: state.cancelled ?? 0 })}</Alert>}
      <p className="text-sm text-muted">{t(next === "SUSPENDED" ? "suspendHint" : "reactivateHint", { count: upcoming })}</p>
      <input type="hidden" name="status" value={next} />
      <label htmlFor="reason" className="block text-sm font-medium">{t("reason")}</label>
      <textarea id="reason" name="reason" rows={2} maxLength={500} className="block w-full rounded-[var(--radius-md)] border border-border bg-surface p-2.5 text-[15px]" />
      {state?.error && <Alert tone="danger">{t(`errors.${state.error}`)}</Alert>}
      <Button type="submit" variant={next === "SUSPENDED" ? "danger" : "primary"} disabled={pending}>{t(next === "SUSPENDED" ? "suspend" : "reactivate")}</Button>
    </form>
  );
}

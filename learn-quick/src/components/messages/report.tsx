"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Flag } from "lucide-react";
import { reportConversationAction } from "@/server/message-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ReportConversation({ conversationId, reported }: { conversationId: string; reported: boolean }) {
  const t = useTranslations("messages");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reportConversationAction.bind(null, conversationId), undefined);
  if (state?.ok || reported) return <span className="text-xs text-muted">{t("reported")}</span>;
  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Flag className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t("report")}</span>
      </Button>
      {open && (
        <form action={action} className="absolute right-0 top-10 z-20 w-72 space-y-2 rounded-[var(--radius-lg)] border border-border bg-surface p-3 shadow-lg">
          <label className="block text-sm font-medium" htmlFor="report-reason">{t("reportWhy")}</label>
          <textarea id="report-reason" name="reason" rows={3} required minLength={5} maxLength={1000} className="block w-full rounded-[var(--radius-md)] border border-border bg-surface p-2 text-[15px]" />
          {state?.error && <Alert tone="danger">{t("reportReason")}</Alert>}
          <Button type="submit" size="sm" disabled={pending}>{t("sendReport")}</Button>
        </form>
      )}
    </div>
  );
}

"use client";

import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { addTimeOffAction, removeTimeOffAction } from "@/server/booking-actions";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/auth/submit-button";
import { useErrorText } from "@/components/auth/use-error";

export function TimeOff({ items }: { items: { id: string; label: string }[] }) {
  const t = useTranslations("calendar");
  const err = useErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, action] = useActionState(addTimeOffAction, undefined);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted">{t("noTimeOff")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>{i.label}</span>
              <Button type="button" variant="ghost" size="sm" aria-label={`${t("remove")}: ${i.label}`} disabled={pending} onClick={() => start(async () => { await removeTimeOffAction(i.id); router.refresh(); })}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]" noValidate>
        <Field id="from" label={t("from")} error={err(state?.errors?.from)}>
          {(a) => <Input {...a} type="date" name="from" min={today} required />}
        </Field>
        <Field id="to" label={t("to")} error={err(state?.errors?.to)}>
          {(a) => <Input {...a} type="date" name="to" min={today} />}
        </Field>
        <SubmitButton variant="secondary" className="sm:w-auto">{t("addTimeOff")}</SubmitButton>
      </form>
    </div>
  );
}

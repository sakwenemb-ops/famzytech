"use client";

import { useTranslations } from "next-intl";
import { contactAction } from "@/server/contact-actions";
import { TOPICS } from "@/lib/contact";
import { useKeepFormAction } from "@/components/ui/use-form-action";
import { Field, Input, Select } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { useErrorText } from "@/components/auth/use-error";

export function ContactForm({ defaults }: { defaults: { name: string; email: string } }) {
  const t = useTranslations("contact");
  const err = useErrorText();
  const [state, onSubmit, pending] = useKeepFormAction(contactAction, undefined);
  if (state?.ok) return <Alert tone="success" role="status">{t("sent")}</Alert>;
  const e = state?.errors ?? {};
  const v = state?.values ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {state?.message && <Alert tone="danger">{state.message === "send_failed" ? t("sendFailed") : err(state.message)}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label={t("name")} error={err(e.name)}>
          {(a) => <Input {...a} name="name" autoComplete="name" defaultValue={v.name ?? defaults.name} />}
        </Field>
        <Field id="email" label={t("email")} hint={t("emailHint")} error={err(e.email)}>
          {(a) => <Input {...a} name="email" type="email" autoComplete="email" defaultValue={v.email ?? defaults.email} />}
        </Field>
      </div>
      <Field id="topic" label={t("topic")}>
        {(a) => (
          <Select {...a} name="topic" defaultValue={v.topic ?? "lesson"}>
            {TOPICS.map((k) => <option key={k} value={k}>{t(`topics.${k}`)}</option>)}
          </Select>
        )}
      </Field>
      <Field id="message" label={t("message")} hint={t("messageHint")} error={e.message ? t("messageShort") : undefined}>
        {(a) => <Textarea {...a} name="message" rows={6} maxLength={4000} defaultValue={v.message ?? ""} />}
      </Field>
      {/* Hidden from people; robots fill it in */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <SubmitButton pending={pending} block={false}>{t("send")}</SubmitButton>
    </form>
  );
}

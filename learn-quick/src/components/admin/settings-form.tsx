"use client";

import { useTranslations } from "next-intl";
import { saveSettingsAction } from "@/server/admin-actions";
import { SETTING_GROUPS, type EditableSetting } from "@/lib/setting-rules";
import { useKeepFormAction } from "@/components/ui/use-form-action";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/auth/submit-button";

export function SettingsForm({ values }: { values: Record<EditableSetting, number | boolean> }) {
  const t = useTranslations("adminSettings");
  const [state, onSubmit, pending] = useKeepFormAction(saveSettingsAction, undefined);
  const e = state?.errors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {state?.ok && <Alert tone="success">{t("saved")}</Alert>}
      {Object.keys(e).length > 0 && <Alert tone="danger">{t("fix")}</Alert>}
      {SETTING_GROUPS.map((g) => (
        <Card key={g.id}>
          <CardHeader><CardTitle>{t(`groups.${g.id}`)}</CardTitle></CardHeader>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {g.keys.map((k) =>
              typeof values[k] === "boolean" ? (
                <label key={k} className="flex items-start gap-3 sm:col-span-2">
                  <input type="checkbox" name={k} defaultChecked={values[k] as boolean} className="mt-1 size-4 accent-[var(--color-primary)]" />
                  <span>
                    <span className="block text-sm font-medium">{t(`keys.${k}.label`)}</span>
                    <span className="block text-xs text-muted">{t(`keys.${k}.hint`)}</span>
                  </span>
                </label>
              ) : (
                <Field key={k} id={k} label={t(`keys.${k}.label`)} hint={t(`keys.${k}.hint`)} error={e[k] ? t("outOfRange") : undefined}>
                  {(a) => <Input {...a} name={k} type="number" inputMode="numeric" defaultValue={values[k] as number} />}
                </Field>
              ),
            )}
          </CardBody>
        </Card>
      ))}
      <SubmitButton pending={pending} block={false}>{t("save")}</SubmitButton>
    </form>
  );
}

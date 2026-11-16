"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { importExercisesAction, saveExerciseAction, setExerciseStatusAction } from "@/server/manage-actions";
import { useKeepFormAction } from "@/components/ui/use-form-action";
import { useRouter } from "@/i18n/navigation";
import { Field, Input, Select } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/auth/submit-button";
import { useErrorText } from "@/components/auth/use-error";
import { LEVELS } from "@/lib/grading";

const TOPICS = ["DAILY_LIFE", "TRAVEL", "HEALTH", "BUSINESS", "LAW", "TECH", "NEWS", "ACADEMIC", "LITERATURE"] as const;
const TYPES = ["SENTENCE", "PARAGRAPH", "FILL_GAP", "MULTIPLE_CHOICE"] as const;

export type ExerciseDefaults = {
  id?: string;
  code?: string | null;
  type: string;
  direction: string;
  level: string;
  topic: string;
  sourceText: string;
  references: string;
  gapTemplate: string;
  options: string;
  keyVocabulary: string;
  commonMistakes: string;
};

export function ExerciseForm({ defaults, isAdmin }: { defaults: ExerciseDefaults; isAdmin: boolean }) {
  const t = useTranslations("manage");
  const tl = useTranslations("library");
  const err = useErrorText();
  const [state, onSubmit, pending] = useKeepFormAction(saveExerciseAction, undefined);
  const [type, setType] = useState(defaults.type);
  const e = state?.errors ?? {};

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      {state?.ok && <Alert tone="success">{t("saved")}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="type" label={t("type")}>
          {(a) => (
            <Select {...a} name="type" value={type} onChange={(ev) => setType(ev.target.value)}>
              {TYPES.map((k) => <option key={k} value={k}>{tl(`types.${k}`)}</option>)}
            </Select>
          )}
        </Field>
        <Field id="direction" label={tl("direction")}>
          {(a) => (
            <Select {...a} name="direction" defaultValue={defaults.direction}>
              <option value="EN_FR">{tl("directions.EN_FR")}</option>
              <option value="FR_EN">{tl("directions.FR_EN")}</option>
            </Select>
          )}
        </Field>
        <Field id="level" label={tl("level")}>
          {(a) => <Select {...a} name="level" defaultValue={defaults.level}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</Select>}
        </Field>
        <Field id="topic" label={tl("topic")}>
          {(a) => <Select {...a} name="topic" defaultValue={defaults.topic}>{TOPICS.map((k) => <option key={k} value={k}>{tl(`topics.${k}`)}</option>)}</Select>}
        </Field>
      </div>
      {isAdmin && (
        <Field id="code" label={t("code")} optionalLabel="" error={err(e.code)}>
          {(a) => <Input {...a} name="code" defaultValue={defaults.code ?? ""} placeholder="en-fr-b1-06" className="sm:max-w-xs" />}
        </Field>
      )}
      <Field id="sourceText" label={t("source")} error={err(e.sourceText)}>
        {(a) => <Textarea {...a} name="sourceText" rows={3} defaultValue={defaults.sourceText} />}
      </Field>
      {type === "FILL_GAP" && (
        <Field id="gapTemplate" label={t("gapTemplate")} error={err(e.gapTemplate)}>
          {(a) => <Input {...a} name="gapTemplate" defaultValue={defaults.gapTemplate} />}
        </Field>
      )}
      {type === "MULTIPLE_CHOICE" ? (
        <Field id="options" label={t("options")} error={err(e.options) ?? err(e.references)}>
          {(a) => <Textarea {...a} name="options" rows={3} defaultValue={defaults.options} />}
        </Field>
      ) : (
        <Field id="references" label={type === "FILL_GAP" ? t("referencesGap") : t("references")} error={err(e.references)}>
          {(a) => <Textarea {...a} name="references" rows={3} defaultValue={defaults.references} />}
        </Field>
      )}
      <Field id="keyVocabulary" label={t("vocabulary")}>
        {(a) => <Textarea {...a} name="keyVocabulary" rows={2} defaultValue={defaults.keyVocabulary} />}
      </Field>
      <Field id="commonMistakes" label={t("mistakes")}>
        {(a) => <Textarea {...a} name="commonMistakes" rows={2} defaultValue={defaults.commonMistakes} />}
      </Field>
      <SubmitButton pending={pending} className="sm:w-auto">{t("save")}</SubmitButton>
    </form>
  );
}

export function StatusButtons({ id, status }: { id: string; status: string }) {
  const t = useTranslations("manage");
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (s: "DRAFT" | "PUBLISHED" | "ARCHIVED") => start(async () => { await setExerciseStatusAction(id, s); router.refresh(); });
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "PUBLISHED" && <Button size="sm" disabled={pending} onClick={() => set("PUBLISHED")}>{t("publish")}</Button>}
      {status === "PUBLISHED" && <Button size="sm" variant="secondary" disabled={pending} onClick={() => set("DRAFT")}>{t("unpublish")}</Button>}
      {status !== "ARCHIVED" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("ARCHIVED")}>{t("archive")}</Button>}
    </div>
  );
}

export function ImportForm() {
  const t = useTranslations("manage");
  const err = useErrorText();
  const [state, action] = useActionState(importExercisesAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted">{t("importHint")}</p>
      {state?.ok && <Alert tone="success">{t("imported", { count: Number(state.message) })}</Alert>}
      {state?.errors?.json && <Alert tone="danger">{err(state.errors.json)} {state.message}</Alert>}
      <Textarea name="json" rows={5} aria-label={t("import")} className="font-mono text-xs" />
      <SubmitButton variant="secondary" className="sm:w-auto">{t("importButton")}</SubmitButton>
    </form>
  );
}

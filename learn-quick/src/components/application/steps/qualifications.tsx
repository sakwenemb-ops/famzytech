"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, FileText, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { addCertificateAction, addEducationAction, removeQualificationAction, setNoQualificationAction } from "@/server/application-actions";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/ui/choice";
import { SubmitButton } from "@/components/auth/submit-button";
import { useErrorText } from "@/components/auth/use-error";
import { FileUpload } from "../file-upload";
import { FieldError } from "../step-buttons";

export type QualificationItem = { id: string; title: string; detail: string; fileUrl: string | null };

/** Certificates (type "certificate") or degrees (type "education"): list, add, remove, or "I have none". */
export function QualificationsStep({ type, items, none }: { type: "certificate" | "education"; items: QualificationItem[]; none: boolean }) {
  const ns = type === "certificate" ? "cert" : "edu";
  const t = useTranslations(`application.${ns}`);
  const tc = useTranslations("application.cert");
  const ti = useTranslations("application.identity");
  const tu = useTranslations("application.upload");
  const err = useErrorText();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, action] = useActionState(type === "certificate" ? addCertificateAction : addEducationAction, undefined);
  const [doc, setDoc] = useState<{ id: string } | null>(null);
  const e = state?.errors ?? {};
  // Clear the uploaded file once the item has been added
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok) setDoc(null);
  }

  return (
    <div className="space-y-7">
      {items.length > 0 && (
        <section>
          <h3 className="mb-2 font-medium">{t("list")}</h3>
          <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
            {items.map((it) => (
              <li key={it.id} className="flex items-start justify-between gap-3 p-3">
                <div className="flex min-w-0 gap-3">
                  <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium">{it.title}</p>
                    <p className="text-sm text-muted">{it.detail}</p>
                    {it.fileUrl && (
                      <a href={it.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                        {tc("openFile")}
                      </a>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  aria-label={`${tc("remove")}: ${it.title}`}
                  onClick={() => start(async () => { await removeQualificationAction(type, it.id); router.refresh(); })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.length === 0 && (
        <Choice
          checked={none}
          disabled={pending}
          onChange={(ev) => start(async () => { await setNoQualificationAction(type, ev.target.checked); router.refresh(); })}
        >
          <span>
            <span className="block font-medium">{t("none")}</span>
            <span className="block text-[13px] text-muted">{t("noneHint")}</span>
          </span>
        </Choice>
      )}

      <form action={action} className="space-y-4 rounded-[var(--radius-md)] bg-surface-2 p-4" noValidate>
        <h3 className="font-medium">{t("add")}</h3>
        {type === "certificate" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label={t("name")} error={err(e.name)}>
              {(a) => <Input {...a} name="name" placeholder={t("namePlaceholder")} maxLength={120} />}
            </Field>
            <Field id="issuer" label={t("issuer")} error={err(e.issuer)}>
              {(a) => <Input {...a} name="issuer" maxLength={120} />}
            </Field>
          </div>
        ) : (
          <>
            <Field id="university" label={t("university")} error={err(e.university)}>
              {(a) => <Input {...a} name="university" maxLength={120} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="degree" label={t("degree")} error={err(e.degree)}>
                {(a) => <Input {...a} name="degree" placeholder={t("degreePlaceholder")} maxLength={80} />}
              </Field>
              <Field id="field" label={t("field")} error={err(e.field)}>
                {(a) => <Input {...a} name="field" maxLength={120} />}
              </Field>
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
          <Field id="yearFrom" label={tc("yearFrom")}>
            {(a) => <Input {...a} name="yearFrom" inputMode="numeric" maxLength={4} />}
          </Field>
          <Field id="yearTo" label={tc("yearTo")}>
            {(a) => <Input {...a} name="yearTo" inputMode="numeric" maxLength={4} />}
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{t("file")}</p>
          <input type="hidden" name="documentId" value={doc?.id ?? ""} />
          {doc ? (
            <p className="flex items-center gap-2 text-sm text-success"><Check className="size-4" aria-hidden />{ti("uploaded")}</p>
          ) : (
            <FileUpload kind={type === "certificate" ? "CERTIFICATE" : "DEGREE"} label={tu("choose")} hint={t("fileHint")} onUploaded={setDoc} />
          )}
          <FieldError message={err(e.documentId)} />
        </div>
        <SubmitButton variant="secondary" className="sm:w-auto">{t("add")}</SubmitButton>
      </form>
    </div>
  );
}

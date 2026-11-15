"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ShieldCheck } from "lucide-react";
import { saveIdentityAction } from "@/server/application-actions";
import { useKeepFormAction } from "@/components/ui/use-form-action";
import { Field, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useErrorText } from "@/components/auth/use-error";
import { FileUpload } from "../file-upload";
import { FieldError, StepButtons } from "../step-buttons";

type Ids = { idDocumentType: string | null; idFrontDocId: string | null; idBackDocId: string | null; idSelfieDocId: string | null };

export function IdentityStep({ defaults }: { defaults: Ids }) {
  const t = useTranslations("application.identity");
  const tc = useTranslations("application.cert");
  const tu = useTranslations("application.upload");
  const err = useErrorText();
  const [state, onSubmit, pending] = useKeepFormAction(saveIdentityAction, undefined);
  const [type, setType] = useState(defaults.idDocumentType ?? "CNI");
  const [docs, setDocs] = useState({ front: defaults.idFrontDocId, back: defaults.idBackDocId, selfie: defaults.idSelfieDocId });
  const e = state?.errors ?? {};

  const slot = (key: "front" | "back" | "selfie", kind: "ID_FRONT" | "ID_BACK" | "ID_SELFIE", field: string, hint: string) => (
    <div className="rounded-[var(--radius-md)] border border-border p-4">
      <p className="font-medium">{t(key)}</p>
      <input type="hidden" name={field} value={docs[key] ?? ""} />
      {docs[key] && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-success">
          <Check className="size-4" aria-hidden />
          {t("uploaded")} ·{" "}
          <a href={`/api/files/${docs[key]}`} target="_blank" rel="noreferrer" className="underline">{tc("openFile")}</a>
        </p>
      )}
      <div className="mt-3">
        <FileUpload
          kind={kind}
          label={docs[key] ? t("replace") : tu("choose")}
          hint={hint}
          capture={key === "selfie" ? "user" : "environment"}
          onUploaded={(d) => setDocs({ ...docs, [key]: d.id })}
        />
      </div>
      <FieldError message={err(e[field])} />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Alert tone="info" className="flex gap-2">
        <ShieldCheck className="size-5 shrink-0" aria-hidden />
        <span>{t("privacy")}</span>
      </Alert>
      <Field id="idDocumentType" label={t("type")} error={err(e.idDocumentType)}>
        {(a) => (
          <Select {...a} name="idDocumentType" value={type} onChange={(ev) => setType(ev.target.value)} className="sm:max-w-sm">
            {(["CNI", "PASSPORT", "RESIDENCE_PERMIT"] as const).map((k) => (
              <option key={k} value={k}>{t(`types.${k}`)}</option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        {slot("front", "ID_FRONT", "idFrontDocId", t("fileHint"))}
        {type !== "PASSPORT" && slot("back", "ID_BACK", "idBackDocId", t("fileHint"))}
        {slot("selfie", "ID_SELFIE", "idSelfieDocId", t("selfieHint"))}
      </div>
      <StepButtons pending={pending} state={state} />
    </form>
  );
}

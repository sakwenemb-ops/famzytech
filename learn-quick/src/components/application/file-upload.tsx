"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import type { DocumentKind } from "@prisma/client";
import { FILE_RULES, acceptFor } from "@/lib/file-rules";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

/**
 * Uploads one file to /api/uploads with a progress bar (useful on slow mobile data)
 * and reports the new document id. The size is checked before sending.
 */
export function FileUpload({
  kind,
  label,
  hint,
  onUploaded,
  variant = "secondary",
  capture,
}: {
  kind: DocumentKind;
  label: string;
  hint?: string;
  onUploaded: (doc: { id: string; url: string; name: string }) => void;
  variant?: "primary" | "secondary";
  capture?: "user" | "environment";
}) {
  const t = useTranslations("application.upload");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const max = FILE_RULES[kind]?.maxBytes ?? 0;

  function upload(file: File) {
    setError(null);
    if (file.size > max) return setError(t("too_large", { max: mb(max) }));
    const body = new FormData();
    body.set("kind", kind);
    body.set("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.upload.onprogress = (e) => e.lengthComputable && setPct(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setPct(null);
      let res: { id?: string; url?: string; error?: string } = {};
      try {
        res = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status === 200 && res.id && res.url) onUploaded({ id: res.id, url: res.url, name: file.name });
      else setError(res.error && t.has(res.error) ? t(res.error, { max: mb(max) }) : t("failed"));
    };
    xhr.onerror = () => {
      setPct(null);
      setError(t("failed"));
    };
    setPct(0);
    xhr.send(body);
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        id={id}
        type="file"
        accept={acceptFor(kind)}
        capture={capture}
        className="sr-only"
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        className={cn(buttonVariants({ variant }), "cursor-pointer", pct !== null && "pointer-events-none opacity-60")}
      >
        <Upload className="size-4" aria-hidden />
        {pct !== null ? t("uploading", { pct }) : label}
      </label>
      {pct !== null && (
        <div className="h-1.5 max-w-xs overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      )}
      {hint && <p id={`${id}-hint`} className="text-[13px] text-muted">{hint}</p>}
      {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
    </div>
  );
}

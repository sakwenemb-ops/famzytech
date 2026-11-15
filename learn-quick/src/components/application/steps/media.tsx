"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { setPhotoAction, setVideoAction } from "@/server/application-actions";
import { Avatar } from "@/components/ui/avatar";
import { FileUpload } from "../file-upload";

/** Photo and video steps: guidelines, current file, and an upload button that saves at once. */
export function MediaStep({ type, name, current }: { type: "photo" | "video"; name: string; current: string | null }) {
  const t = useTranslations(`application.${type}`);
  const router = useRouter();
  const [pending, start] = useTransition();
  const good = t.raw("good") as string[];
  const bad = t.raw("bad") as string[];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius-md)] bg-success-soft p-4">
          <p className="font-medium text-success">{t("goodTitle")}</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {good.map((g) => (
              <li key={g} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{g}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-[var(--radius-md)] bg-danger-soft p-4">
          <p className="font-medium text-danger">{t("badTitle")}</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {bad.map((b) => (
              <li key={b} className="flex gap-2"><X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />{b}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {type === "photo" ? (
          <Avatar name={name} src={current} size={128} />
        ) : current ? (
          <video src={current} controls preload="metadata" playsInline className="aspect-video w-full max-w-md rounded-[var(--radius-md)] bg-black" />
        ) : null}
        <div aria-busy={pending}>
          <FileUpload
            kind={type === "photo" ? "PROFILE_PHOTO" : "INTRO_VIDEO"}
            label={current ? t("change") : t("upload")}
            hint={t("hint")}
            variant={current ? "secondary" : "primary"}
            onUploaded={(doc) =>
              start(async () => {
                await (type === "photo" ? setPhotoAction(doc.id) : setVideoAction(doc.id));
                router.refresh();
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

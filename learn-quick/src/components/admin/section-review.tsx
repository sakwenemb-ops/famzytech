"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ApplicationSection } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { decideSectionAction } from "@/server/review-actions";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/ui/choice";
import { Textarea } from "@/components/ui/textarea";

type Decision = "APPROVED" | "NEEDS_CHANGES" | "REJECTED";

export function SectionReview({
  applicationId,
  section,
  current,
  enabled,
}: {
  applicationId: string;
  section: ApplicationSection;
  current: { decision: string; comment: string | null } | null;
  enabled: boolean;
}) {
  const t = useTranslations("review");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [decision, setDecision] = useState<Decision | null>((current?.decision as Decision) ?? null);
  const [comment, setComment] = useState(current?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const changed = decision !== (current?.decision ?? null) || comment !== (current?.comment ?? "");
  const name = `decision-${section}`;

  if (!enabled) return null;
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <fieldset>
        <legend className="sr-only">{section}</legend>
        <div className="flex flex-wrap gap-2">
          {(["APPROVED", "NEEDS_CHANGES", "REJECTED"] as const).map((d) => (
            <Choice key={d} variant="chip" type="radio" name={name} value={d} checked={decision === d} onChange={() => setDecision(d)}>
              {t(`decision.${d}`)}
            </Choice>
          ))}
        </div>
      </fieldset>
      {decision && decision !== "APPROVED" && (
        <div>
          <label htmlFor={`${name}-comment`} className="mb-1 block text-sm font-medium">{t("comment")}</label>
          <Textarea id={`${name}-comment`} rows={2} maxLength={1000} value={comment} placeholder={t("commentPlaceholder")} onChange={(e) => setComment(e.target.value)} />
        </div>
      )}
      {error && <p className="text-[13px] text-danger" role="alert">{t(`errors.${error}`)}</p>}
      <Button
        type="button"
        size="sm"
        variant={changed ? "primary" : "secondary"}
        disabled={!decision || !changed || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await decideSectionAction(applicationId, {
              section,
              decision: decision!,
              comment: decision === "APPROVED" ? comment || undefined : comment.trim() || undefined,
            });
            if (res?.error) setError(res.error);
            else router.refresh();
          })
        }
      >
        {t("saveDecision")}
      </Button>
    </div>
  );
}

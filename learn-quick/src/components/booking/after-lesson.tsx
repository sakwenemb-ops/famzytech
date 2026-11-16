"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { saveLessonNotesAction, submitReviewAction } from "@/server/lesson-actions";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { useErrorText } from "@/components/auth/use-error";
import { cn } from "@/lib/utils";

export function ReviewForm({ bookingId, teacherName }: { bookingId: string; teacherName: string }) {
  const t = useTranslations("afterLesson");
  const err = useErrorText();
  const [state, action] = useActionState(submitReviewAction, undefined);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  if (state?.ok) return <Alert tone="success">{t("thanks")}</Alert>;
  return (
    <form action={action} className="space-y-3 rounded-[var(--radius-md)] bg-surface-2 p-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <p className="font-medium">{t("rateTitle", { name: teacherName })}</p>
      <div role="radiogroup" aria-label={t("rating")} className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={t("stars", { n })}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            className="p-0.5"
          >
            <Star className={cn("size-7", n <= (hover || rating) ? "fill-accent text-accent" : "text-border")} aria-hidden />
          </button>
        ))}
      </div>
      {state?.errors?.rating && <p className="text-[13px] text-danger" role="alert">{err(state.errors.rating)}</p>}
      {state?.message && !state.ok && <Alert tone="danger">{err(state.message)}</Alert>}
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{t("comment")}</span>
        <Textarea name="comment" rows={3} maxLength={1500} />
        <span className="block text-xs text-muted">{t("commentHint")}</span>
      </label>
      <SubmitButton className="sm:w-auto">{t("submitReview")}</SubmitButton>
    </form>
  );
}

export function NotesForm({ bookingId, studentName, defaults }: { bookingId: string; studentName: string; defaults: { teacherNotes: string; homework: string } }) {
  const t = useTranslations("afterLesson");
  const [state, action] = useActionState(saveLessonNotesAction, undefined);
  // Open at first when nothing is written yet; after that the teacher decides (saving doesn't close it)
  const [open, setOpen] = useState(!defaults.teacherNotes && !defaults.homework);
  return (
    <details className="rounded-[var(--radius-md)] bg-surface-2 p-4" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-medium">{t("notesTitle")} · <span className="font-normal text-muted">{t("notesFor", { name: studentName })}</span></summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="bookingId" value={bookingId} />
        {state?.ok && <Alert tone="success">{t("notesSaved")}</Alert>}
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("teacherNotes")}</span>
          <Textarea name="teacherNotes" rows={3} maxLength={5000} defaultValue={defaults.teacherNotes} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("homework")}</span>
          <Textarea name="homework" rows={2} maxLength={5000} defaultValue={defaults.homework} />
        </label>
        <SubmitButton variant="secondary" className="sm:w-auto">{t("saveNotes")}</SubmitButton>
      </form>
    </details>
  );
}

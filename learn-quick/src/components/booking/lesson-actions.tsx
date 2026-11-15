"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cancelAction, rescheduleAction } from "@/server/booking-actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SlotPicker } from "./slot-picker";

/** Cancel and change-time buttons for one upcoming lesson. */
export function LessonActions({
  bookingId,
  teacherId,
  role,
  startsAt,
  freeCancelHours,
  timeZone,
}: {
  bookingId: string;
  teacherId: string;
  role: "student" | "teacher";
  startsAt: string;
  freeCancelHours: number;
  timeZone: string;
}) {
  const t = useTranslations("lessons");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [moving, setMoving] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const early = new Date(startsAt).getTime() - Date.now() >= freeCancelHours * 3_600_000;

  const cancel = () => {
    const msg = role === "teacher" ? t("confirmCancelTeacher") : early ? t("confirmCancelFree") : t("confirmCancelLate", { hours: freeCancelHours });
    if (!window.confirm(msg)) return;
    start(async () => {
      const res = await cancelAction(bookingId);
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {role === "student" && early && (
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => setMoving((m) => !m)} aria-expanded={moving}>
            {moving ? t("keep") : t("reschedule")}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={cancel} className="text-danger">
          {t("cancel")}
        </Button>
      </div>
      {role === "student" && !early && <p className="text-xs text-muted">{t("tooLateToChange", { hours: freeCancelHours })}</p>}
      {moving && (
        <div className="rounded-[var(--radius-md)] border border-border p-4">
          <p className="mb-3 text-sm font-medium">{t("rescheduleTitle")}</p>
          <SlotPicker teacherId={teacherId} timeZone={timeZone} selected={slot} onSelect={setSlot} />
          <Button
            type="button"
            className="mt-3"
            disabled={!slot || pending}
            onClick={() =>
              start(async () => {
                const res = await rescheduleAction(bookingId, slot!);
                if ("error" in res) setError(res.error);
                else {
                  setMoving(false);
                  router.refresh();
                }
              })
            }
          >
            {t("reschedule")}
          </Button>
        </div>
      )}
      {error && <Alert tone="danger">{t(`errors.${error}`)}</Alert>}
    </div>
  );
}

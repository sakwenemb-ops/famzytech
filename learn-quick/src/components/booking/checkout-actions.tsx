"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cancelAction } from "@/server/booking-actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/** Counts down the 15-minute hold; reloads the page when it runs out. */
export function HoldTimer({ expiresAt }: { expiresAt: string }) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const [left, setLeft] = useState(() => new Date(expiresAt).getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(id);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, router]);
  const s = Math.max(0, Math.floor(left / 1000));
  const time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return <Alert tone={s < 120 ? "warning" : "info"}><span role="timer">{t("holdTimer", { time })}</span></Alert>;
}

export function CancelHoldButton({ bookingId, teacherHref }: { bookingId: string; teacherHref: string }) {
  const t = useTranslations("checkout");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" block disabled={pending} onClick={() => start(async () => { await cancelAction(bookingId); router.push(teacherHref); })}>
      {t("cancel")}
    </Button>
  );
}

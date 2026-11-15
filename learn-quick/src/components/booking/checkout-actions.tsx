"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { cancelAction, devPayAction } from "@/server/booking-actions";
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

export function DevPayButton({ bookingId }: { bookingId: string }) {
  const t = useTranslations("checkout");
  const [pending, start] = useTransition();
  const [expired, setExpired] = useState(false);
  return (
    <div className="space-y-2 rounded-[var(--radius-md)] border border-dashed border-warning p-4">
      <Button
        block
        disabled={pending}
        onClick={() => start(async () => {
          const res = await devPayAction(bookingId);
          if (res && "error" in res) setExpired(true);
        })}
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {t("devPay")}
      </Button>
      <p className="text-xs text-muted">{t("devPayNote")}</p>
      {expired && <Alert tone="danger">{t("expired")}</Alert>}
    </div>
  );
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

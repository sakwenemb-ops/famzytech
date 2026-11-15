"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { holdAction } from "@/server/booking-actions";
import type { BookingOption } from "@/server/booking";
import { formatXaf } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Choice } from "@/components/ui/choice";
import { Alert } from "@/components/ui/alert";
import { SlotPicker } from "./slot-picker";

export type WidgetOption = { option: BookingOption; perLesson: number; total: number; discountPct: number; size?: number };

export function BookingWidget({
  teacherId,
  viewer,
  timeZone,
  options,
  creditsLeft,
}: {
  teacherId: string;
  viewer: "anon" | "student" | "other";
  timeZone: string | null;
  options: WidgetOption[];
  creditsLeft: number;
}) {
  const t = useTranslations("booking");
  const locale = useLocale() as "en" | "fr";
  const [slot, setSlot] = useState<string | null>(null);
  const [option, setOption] = useState<BookingOption>(creditsLeft > 0 ? "CREDIT" : options[0]?.option ?? "SINGLE");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [refresh, setRefresh] = useState(0);
  const tz = timeZone ?? undefined;

  const label = (o: WidgetOption) =>
    o.option === "CREDIT" ? t("options.CREDIT") : o.option.startsWith("PACK") ? t("options.PACK", { size: o.size! }) : t(`options.${o.option}`);

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">{t("chooseTime")}</h2>
      <SlotPicker key={refresh} teacherId={teacherId} timeZone={timeZone} selected={slot} onSelect={(s) => { setSlot(s); setError(null); }} />

      {slot && (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium" aria-live="polite">
            {t("selected", { when: new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone: tz }).format(new Date(slot)) })}
          </p>
          {viewer === "anon" ? (
            <Link href="/login" className={buttonVariants({ block: true })}>{t("loginToBook")}</Link>
          ) : viewer === "other" ? (
            <Alert tone="info">{t("studentsOnly")}</Alert>
          ) : (
            <>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t("chooseOption")}</legend>
                <div className="space-y-2">
                  {creditsLeft > 0 && (
                    <Choice type="radio" name="option" checked={option === "CREDIT"} onChange={() => setOption("CREDIT")}>
                      <span className="flex flex-1 justify-between gap-2 text-sm">
                        <span className="font-medium">{t("options.CREDIT")}</span>
                        <span className="text-muted">{t("creditsLeft", { count: creditsLeft })}</span>
                      </span>
                    </Choice>
                  )}
                  {options.map((o) => (
                    <Choice key={o.option} type="radio" name="option" checked={option === o.option} onChange={() => setOption(o.option)}>
                      <span className="flex flex-1 flex-wrap justify-between gap-x-2 text-sm">
                        <span>
                          <span className="font-medium">{label(o)}</span>
                          {o.discountPct > 0 && <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">{t("packSave", { pct: o.discountPct })}</span>}
                          {o.size && <span className="block text-xs text-muted">{t("perLesson", { price: formatXaf(o.perLesson, locale) })}</span>}
                        </span>
                        <span className="font-semibold tabular-nums">{formatXaf(o.total, locale)}</span>
                      </span>
                    </Choice>
                  ))}
                </div>
              </fieldset>
              {error && <Alert tone="danger">{t(`errors.${error}`)}</Alert>}
              <Button
                block
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const res = await holdAction(teacherId, slot, option);
                    if (res && "error" in res) {
                      setError(res.error);
                      // Someone else took it: reload the free times
                      if (res.error === "slot_taken") setRefresh((n) => n + 1);
                    }
                  })
                }
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {option === "CREDIT" ? t("confirmCredit") : t("continue")}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSlotsAction } from "@/server/booking-actions";
import { dayKey } from "@/lib/slots";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;

/** A week of free times, shown in the viewer's time zone. `timeZone` null = use the browser's. */
export function SlotPicker({
  teacherId,
  timeZone,
  selected,
  onSelect,
}: {
  teacherId: string;
  timeZone: string | null;
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const [tz, setTz] = useState(timeZone ?? "Africa/Douala");
  const [week, setWeek] = useState(0);
  const [slots, setSlots] = useState<string[] | null>(null);

  useEffect(() => {
    if (!timeZone) {
      try {
        setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Douala");
      } catch {}
    }
  }, [timeZone]);

  useEffect(() => {
    let live = true;
    setSlots(null);
    const from = new Date(Date.now() + week * 7 * DAY);
    getSlotsAction(teacherId, from.toISOString(), new Date(from.getTime() + 7 * DAY).toISOString()).then((s) => live && setSlots(s));
    return () => {
      live = false;
    };
  }, [teacherId, week]);

  // Group by day in the viewer's zone
  const days = useMemo(() => {
    const start = Date.now() + week * 7 * DAY;
    const keys = Array.from({ length: 7 }, (_, i) => dayKey(new Date(start + i * DAY), tz));
    const map = new Map(keys.map((k) => [k, [] as string[]]));
    for (const s of slots ?? []) map.get(dayKey(new Date(s), tz))?.push(s);
    return [...map.entries()];
  }, [slots, week, tz]);

  const dayLabel = (key: string) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
  const time = (iso: string) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  const empty = slots !== null && slots.length === 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={week === 0} onClick={() => setWeek((w) => w - 1)} aria-label={t("prevWeek")}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <p className="text-center text-xs text-muted">{t("yourTime", { tz: tz.replaceAll("_", " ") })}</p>
        <Button type="button" variant="ghost" size="sm" disabled={week >= 11} onClick={() => setWeek((w) => w + 1)} aria-label={t("nextWeek")}>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
      {slots === null ? (
        <p className="py-8 text-center text-sm text-muted" role="status">{t("loading")}</p>
      ) : empty ? (
        <p className="py-8 text-center text-sm text-muted">{t("noSlots")}</p>
      ) : (
        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {days.filter(([, list]) => list.length).map(([key, list]) => (
            <div key={key}>
              <p className="mb-1.5 text-xs font-semibold capitalize text-muted">{dayLabel(key)}</p>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {list.map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-slot={s}
                    onClick={() => onSelect(s)}
                    aria-pressed={selected === s}
                    aria-label={`${dayLabel(key)} ${time(s)}`}
                    className={cn(
                      "rounded-[var(--radius-sm)] border px-2 py-1.5 text-sm tabular-nums transition-colors",
                      selected === s ? "border-primary bg-primary text-primary-fg" : "border-border hover:border-primary hover:bg-primary-soft",
                    )}
                  >
                    {time(s)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

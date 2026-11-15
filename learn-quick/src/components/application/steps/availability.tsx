"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { saveAvailabilityAction } from "@/server/application-actions";
import { useKeepFormAction } from "@/components/ui/use-form-action";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/components/auth/use-error";
import { FieldError, StepButtons } from "../step-buttons";
import type { FormState } from "@/server/auth-actions";

type Slot = { weekday: number; startMin: number; endMin: number };
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const TIMES = Array.from({ length: 49 }, (_, i) => i * 30); // 00:00 … 24:00
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

type SaveAction = (state: FormState, fd: FormData) => Promise<FormState>;

/** Weekly hours editor. Used in the application (with "Save and continue") and on the teacher calendar. */
export function AvailabilityStep({
  defaults,
  timeZone,
  action = saveAvailabilityAction,
  standalone = false,
}: {
  defaults: Slot[];
  timeZone: string;
  action?: SaveAction;
  standalone?: boolean;
}) {
  const t = useTranslations("application.availability");
  const locale = useLocale();
  const err = useErrorText();
  const [state, onSubmit, pending] = useKeepFormAction(action, undefined);
  const [slots, setSlots] = useState<Slot[]>(defaults);

  // Weekday names in the interface language (1 Jan 2023 was a Sunday)
  const dayName = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
    return (d: number) => f.format(new Date(Date.UTC(2023, 0, 1 + d)));
  }, [locale]);

  const add = (weekday: number) => {
    const last = slots.filter((s) => s.weekday === weekday).sort((a, b) => b.endMin - a.endMin)[0];
    const start = last ? Math.min(last.endMin, 1320) : 1080; // default 18:00–20:00
    setSlots([...slots, { weekday, startMin: start, endMin: Math.min(start + 120, 1440) }]);
  };
  const update = (i: number, patch: Partial<Slot>) => setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const copyMonday = () => {
    const monday = slots.filter((s) => s.weekday === 1);
    setSlots([...slots.filter((s) => s.weekday === 0 || s.weekday === 6 || s.weekday === 1), ...[2, 3, 4, 5].flatMap((d) => monday.map((s) => ({ ...s, weekday: d })))]);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <p className="text-sm text-muted">{t("intro", { tz: timeZone.replaceAll("_", " ") })}</p>
      <input type="hidden" name="slots" value={JSON.stringify(slots)} />
      <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
        {ORDER.map((d) => {
          const day = slots.map((s, i) => ({ s, i })).filter(({ s }) => s.weekday === d);
          return (
            <li key={d} className="grid gap-2 p-3 sm:grid-cols-[130px_1fr]">
              <span className="pt-2 font-medium capitalize">{dayName(d)}</span>
              <div className="space-y-2">
                {day.length === 0 && <p className="pt-2 text-sm text-muted">{t("off")}</p>}
                {day.map(({ s, i }) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select aria-label={`${dayName(d)} · ${t("from")}`} value={s.startMin} onChange={(e) => update(i, { startMin: Number(e.target.value) })} className="w-28">
                      {TIMES.slice(0, -1).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
                    </Select>
                    <span aria-hidden className="text-muted">–</span>
                    <Select aria-label={`${dayName(d)} · ${t("to")}`} value={s.endMin} onChange={(e) => update(i, { endMin: Number(e.target.value) })} className="w-28">
                      {TIMES.slice(1).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
                    </Select>
                    <Button type="button" variant="ghost" size="sm" aria-label={t("remove")} onClick={() => setSlots(slots.filter((_, j) => j !== i))}>
                      <X className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="link" className="text-sm" onClick={() => add(d)}>
                  <Plus className="size-4" aria-hidden />
                  {t("add")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {slots.some((s) => s.weekday === 1) && (
        <Button type="button" variant="secondary" size="sm" onClick={copyMonday}>{t("copy")}</Button>
      )}
      <FieldError message={err(state?.errors?.slots)} />
      <StepButtons pending={pending} state={state} last={standalone} />
    </form>
  );
}

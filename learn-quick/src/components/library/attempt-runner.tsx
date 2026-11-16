"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Lightbulb, Loader2 } from "lucide-react";
import { hintAction, saveAnswerAction, submitAttemptAction } from "@/server/library-actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export type RunnerItem = {
  id: string;
  type: "SENTENCE" | "PARAGRAPH" | "FILL_GAP" | "MULTIPLE_CHOICE";
  direction: "EN_FR" | "FR_EN";
  level: string;
  sourceText: string;
  gapTemplate: string | null;
  options: string[]; // texts only: which one is correct never reaches the browser
  answerText: string;
  choiceIndex: number | null;
  hintUsed: boolean;
  vocabulary: { source: string; target: string }[] | null;
};

const ACCENTS = ["é", "è", "ê", "à", "â", "ç", "ô", "î", "ï", "û", "ù", "ë", "œ", "É", "À", "Ç", "«", "»"];

export function AttemptRunner({ attemptId, items, deadline }: { attemptId: string; items: RunnerItem[]; deadline: string | null }) {
  const t = useTranslations("library");
  const [answers, setAnswers] = useState(() => Object.fromEntries(items.map((i) => [i.id, { text: i.answerText, choice: i.choiceIndex }])));
  const [vocab, setVocab] = useState(() => Object.fromEntries(items.filter((i) => i.vocabulary).map((i) => [i.id, i.vocabulary!])));
  const [saving, setSaving] = useState<Record<string, "saving" | "saved">>({});
  const [timeUp, setTimeUp] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const fields = useRef<Record<string, HTMLTextAreaElement | HTMLInputElement | null>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, () => Promise<unknown>>>({});

  const save = useCallback(
    (itemId: string, value: { answerText?: string; choiceIndex?: number }, delay = 700) => {
      setSaving((s) => ({ ...s, [itemId]: "saving" }));
      clearTimeout(timers.current[itemId]);
      const run = async () => {
        delete pending.current[itemId];
        await saveAnswerAction(attemptId, itemId, value);
        setSaving((s) => ({ ...s, [itemId]: "saved" }));
      };
      pending.current[itemId] = run;
      timers.current[itemId] = setTimeout(run, delay);
    },
    [attemptId],
  );

  const setText = (itemId: string, text: string) => {
    setAnswers((a) => ({ ...a, [itemId]: { ...a[itemId], text } }));
    save(itemId, { answerText: text });
  };

  const insert = (itemId: string, ch: string) => {
    const el = fields.current[itemId];
    const cur = answers[itemId].text;
    const start = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? cur.length;
    setText(itemId, cur.slice(0, start) + ch + cur.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + ch.length, start + ch.length);
    });
  };

  const finish = useCallback(
    (force = false) => {
      const blank = items.filter((i) => (i.type === "MULTIPLE_CHOICE" ? answers[i.id].choice == null : !answers[i.id].text.trim())).length;
      if (!force && blank > 0 && !window.confirm(t("confirmSubmit", { count: blank }))) return;
      startSubmit(async () => {
        // Save anything still waiting before submitting
        for (const id of Object.keys(timers.current)) clearTimeout(timers.current[id]);
        await Promise.all(Object.values(pending.current).map((run) => run()));
        await submitAttemptAction(attemptId);
      });
    },
    [answers, attemptId, items, t],
  );

  // Exam countdown; submits by itself when the time is up
  const [left, setLeft] = useState(() => (deadline ? new Date(deadline).getTime() - Date.now() : null));
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => {
      const ms = new Date(deadline).getTime() - Date.now();
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(id);
        setTimeUp(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  useEffect(() => {
    if (timeUp) finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when time runs out
  }, [timeUp]);

  const clock = left == null ? null : `${Math.max(0, Math.floor(left / 60_000))}:${String(Math.max(0, Math.floor((left % 60_000) / 1000))).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      {clock && (
        <div className={cn("sticky top-16 z-10 rounded-[var(--radius-md)] border px-4 py-2 text-center text-sm font-medium backdrop-blur", left! < 120_000 ? "border-danger/40 bg-danger-soft text-danger" : "border-border bg-surface/90")} role="timer">
          {t("timeLeft", { time: clock })}
        </div>
      )}
      {timeUp && <Alert tone="warning">{t("timeUp")}</Alert>}

      {items.map((item, n) => {
        const into = item.direction === "EN_FR" ? "fr" : "en";
        const st = saving[item.id];
        return (
          <section key={item.id} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5" aria-labelledby={`q-${item.id}`} data-item={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>{t("question", { n: n + 1, total: items.length })} · {t(`directions.${item.direction}`)} · {item.level}</span>
              {st && <span aria-live="polite">{st === "saving" ? t("saving") : t("saved")}</span>}
            </div>
            <h2 id={`q-${item.id}`} className="mt-1 font-semibold">{t(`types.${item.type}`)}</h2>
            <blockquote lang={item.direction === "EN_FR" ? "en" : "fr"} className="mt-3 rounded-[var(--radius-md)] bg-surface-2 px-4 py-3 text-[17px] leading-relaxed">
              {item.sourceText}
            </blockquote>

            <div className="mt-4">
              {item.type === "MULTIPLE_CHOICE" ? (
                <fieldset className="space-y-2">
                  <legend className="sr-only">{t("yourAnswer")}</legend>
                  {item.options.map((o, i) => (
                    <label key={i} className={cn("flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border p-3", answers[item.id].choice === i ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2")}>
                      <input
                        type="radio"
                        name={`mc-${item.id}`}
                        checked={answers[item.id].choice === i}
                        onChange={() => {
                          setAnswers((a) => ({ ...a, [item.id]: { ...a[item.id], choice: i } }));
                          save(item.id, { choiceIndex: i }, 0);
                        }}
                        className="mt-1 size-4 accent-[var(--color-primary)]"
                      />
                      <span lang={into}>{o}</span>
                    </label>
                  ))}
                </fieldset>
              ) : item.type === "FILL_GAP" ? (
                <p lang={into} className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[17px]">
                  {item.gapTemplate!.split("___").map((part, i, arr) => (
                    <span key={i} className="contents">
                      {part && <span>{part}</span>}
                      {i < arr.length - 1 && (
                        <input
                          ref={(el) => { fields.current[item.id] = el; }}
                          aria-label={t("yourAnswer")}
                          value={answers[item.id].text}
                          onChange={(e) => setText(item.id, e.target.value)}
                          autoCapitalize="off"
                          spellCheck={false}
                          className="h-10 w-40 rounded-[var(--radius-sm)] border-b-2 border-primary bg-primary-soft px-2 text-center focus:outline-none"
                        />
                      )}
                    </span>
                  ))}
                </p>
              ) : (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">{t("yourTranslation")}</span>
                  <textarea
                    ref={(el) => { fields.current[item.id] = el; }}
                    lang={into}
                    value={answers[item.id].text}
                    onChange={(e) => setText(item.id, e.target.value)}
                    rows={item.type === "PARAGRAPH" ? 6 : 2}
                    maxLength={4000}
                    className="w-full rounded-[var(--radius-md)] border border-border bg-surface p-3 text-[16px] leading-relaxed focus:border-primary focus:outline-none"
                  />
                </label>
              )}
            </div>

            {item.type !== "MULTIPLE_CHOICE" && into === "fr" && (
              <div className="mt-2 flex flex-wrap gap-1" role="toolbar" aria-label={t("accents")}>
                {ACCENTS.map((ch) => (
                  <button key={ch} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(item.id, ch)} aria-label={t("insertChar", { char: ch })} className="h-8 min-w-8 rounded-[var(--radius-sm)] border border-border bg-surface px-2 text-sm hover:bg-surface-2">
                    {ch}
                  </button>
                ))}
              </div>
            )}

            {vocab[item.id] ? (
              <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                {vocab[item.id].map((v) => <li key={v.source} className="rounded-full bg-accent-soft px-3 py-1"><b>{v.source}</b> → {v.target}</li>)}
              </ul>
            ) : item.type !== "MULTIPLE_CHOICE" ? (
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
                title={t("hintCost")}
                onClick={async () => {
                  if (!window.confirm(t("hintCost"))) return;
                  const v = await hintAction(attemptId, item.id);
                  if (v) setVocab((x) => ({ ...x, [item.id]: v }));
                }}
              >
                <Lightbulb className="size-4" aria-hidden />
                {t("hint")}
              </button>
            ) : null}
          </section>
        );
      })}

      <Button size="lg" block disabled={submitting} onClick={() => finish()}>
        {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {t("submit")}
      </Button>
    </div>
  );
}

import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, XCircle } from "lucide-react";
import { Link, redirect } from "@/i18n/navigation";
import { locate } from "@/lib/grading";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/session";
import { getAttempt, type AnswerError } from "@/server/library/service";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { GradingWait } from "@/components/library/grading-wait";

/** The student's text with each quoted mistake underlined. */
function Highlighted({ text, errors }: { text: string; errors: AnswerError[] }) {
  const marks = errors
    .map((e, i) => ({ i, at: locate(text, e.excerpt) }))
    .filter((m): m is { i: number; at: [number, number] } => Boolean(m.at))
    .sort((a, b) => a.at[0] - b.at[0])
    .filter((m, k, arr) => k === 0 || m.at[0] >= arr[k - 1].at[1]); // no overlaps
  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const m of marks) {
    out.push(text.slice(pos, m.at[0]));
    out.push(
      <mark key={m.i} className="rounded bg-danger-soft px-0.5 text-danger underline decoration-wavy">
        {text.slice(m.at[0], m.at[1])}
        <sup className="ml-0.5 text-[10px] no-underline">{m.i + 1}</sup>
      </mark>,
    );
    pos = m.at[1];
  }
  out.push(text.slice(pos));
  return <>{out}</>;
}

export default async function ResultsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser();
  const a = await getAttempt(user, id);
  if (!a) notFound();
  if (a.status === "IN_PROGRESS") redirect({ href: `/library/attempt/${a.id}`, locale: await getLocale() });
  const t = await getTranslations("library");

  if (a.status === "SUBMITTED") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-semibold">{t("results")}</h1>
        <GradingWait attemptId={a.id} />
      </div>
    );
  }

  const pct = a.scorePct ?? 0;
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("results")}</h1>

      <section className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted">{t("score")}</p>
          <p className={cn("text-4xl font-semibold tabular-nums", pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-danger")} data-testid="score">{pct} %</p>
        </div>
        <div>
          <p className="text-sm text-muted">{t("estimatedLevel")}</p>
          <p className="text-4xl font-semibold">{a.estimatedLevel}</p>
        </div>
      </section>

      {a.test.isTimedExam && (a.passed ? (
        <Alert tone="success" className="flex flex-wrap items-center justify-between gap-3">
          <span>{t("passed")}</span>
          <Link href={`/library/certificate/${a.id}`} className={buttonVariants({ size: "sm" })}>{t("certificate")}</Link>
        </Alert>
      ) : (
        <Alert tone="warning">{t("failed", { pass: a.test.passMark })}</Alert>
      ))}
      {a.status === "PENDING_REVIEW" && <Alert tone="info">{t("pendingAi")}</Alert>}

      <ol className="space-y-4">
        {a.test.items.map((item, n) => {
          const ex = item.exercise;
          const ans = a.answers.find((x) => x.itemId === item.id);
          const score = ans?.scorePct ?? 0;
          const ok = score >= 80;
          const errors = (ans?.errors ?? []) as AnswerError[];
          const options = (ex.options ?? []) as { text: string; correct: boolean }[];
          const text = ans?.answerText?.trim() ?? "";
          return (
            <li key={item.id} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5" data-result={ex.type}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted">{t("question", { n: n + 1, total: a.test.items.length })} · {t(`directions.${ex.direction}`)} · {ex.level}</p>
                  <p className="mt-1 text-[15px]">{ex.sourceText}</p>
                </div>
                <span className={cn("flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums", ok ? "text-success" : "text-danger")}>
                  {ok ? <CheckCircle2 className="size-4" aria-label={t("correct")} /> : <XCircle className="size-4" aria-label={t("incorrect")} />}
                  {score}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-[15px]">
                {ex.type === "MULTIPLE_CHOICE" ? (
                  <>
                    <p><span className="text-muted">{t("yourAnswer")} : </span>{ans?.choiceIndex != null ? options[ans.choiceIndex]?.text : t("noAnswer")}</p>
                    {!ok && <p><span className="text-muted">{t("rightAnswer")} : </span><b>{options.find((o) => o.correct)?.text}</b></p>}
                  </>
                ) : (
                  <>
                    <p className="rounded-[var(--radius-md)] bg-surface-2 px-3 py-2">
                      <span className="block text-xs text-muted">{t("yourAnswer")}</span>
                      {text ? <Highlighted text={text} errors={errors} /> : <i className="text-muted">{t("noAnswer")}</i>}
                    </p>
                    {ex.type === "FILL_GAP" && ans?.feedback === "accent" && <p className="text-warning">{t("accentOnly")}</p>}
                    {ex.type === "FILL_GAP" && !ok && <p><span className="text-muted">{t("rightAnswer")} : </span><b>{ex.references.join(" / ")}</b></p>}
                  </>
                )}

                {errors.length > 0 && (
                  <ol className="space-y-1.5 text-sm">
                    {errors.map((e, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-xs font-semibold text-danger">{i + 1}</span>
                        <span>
                          <Badge tone="danger" className="mr-1.5">{t.has(`errorTypes.${e.type}`) ? t(`errorTypes.${e.type}`) : e.type}</Badge>
                          <s className="text-muted">{e.excerpt}</s> → <b>{e.suggestion}</b>. {e.explanation}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}

                {(ex.type === "SENTENCE" || ex.type === "PARAGRAPH") && text && ans?.correctedText && (
                  <p className="rounded-[var(--radius-md)] bg-success-soft px-3 py-2">
                    <span className="block text-xs text-success">{ans.gradedBy === "claude" ? t("correctedVersion") : t("modelAnswer")}</span>
                    {ans.correctedText}
                  </p>
                )}

                {ans?.gradedBy === "claude" && (
                  <dl className="grid grid-cols-2 gap-2 pt-1 text-xs sm:grid-cols-4">
                    {(["accuracy", "grammar", "vocabulary", "style"] as const).map((k) => (
                      <div key={k}>
                        <dt className="text-muted">{t(`rubric.${k}`)}</dt>
                        <dd className="mt-0.5 flex items-center gap-1.5">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="block h-full bg-primary" style={{ width: `${ans[k] ?? 0}%` }} /></span>
                          <span className="tabular-nums">{ans[k]}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {ans?.gradedBy === "claude" && ans.feedback && <p className="text-sm italic text-muted">{ans.feedback}</p>}
                {(ans?.gradedBy === "basic" || ans?.gradedBy === "basic-retry") && <p className="text-xs text-muted">{t("basicGraded")}</p>}
                {ans?.hintUsed && <p className="text-xs text-muted">{t("hintUsed")} (−20 %)</p>}
                {!ok && ex.commonMistakes && <p className="text-sm text-muted">💡 {ex.commonMistakes}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-3">
        <Link href="/library" className={buttonVariants()}>{t("practiceAgain")}</Link>
        <Link href="/library/history" className={buttonVariants({ variant: "secondary" })}>{t("history")}</Link>
      </div>
    </div>
  );
}

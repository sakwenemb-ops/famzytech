import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/server/session";
import { progress } from "@/server/library/service";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/shell";

/** Scores over time as a simple line chart (last 20 results). */
function ScoreChart({ scores, label }: { scores: number[]; label: string }) {
  if (scores.length < 2) return null;
  const w = 600, h = 160, pad = 24;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (scores.length - 1);
  const y = (s: number) => h - pad - (s / 100) * (h - 2 * pad);
  const d = scores.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`${label}: ${scores.join(", ")}`}>
      {[0, 50, 70, 100].map((g) => (
        <g key={g}>
          <line x1={pad} x2={w - pad} y1={y(g)} y2={y(g)} stroke="var(--color-border)" strokeDasharray={g === 70 ? "4 4" : undefined} />
          <text x={4} y={y(g) + 4} fontSize="10" fill="var(--color-muted)">{g}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" />
      {scores.map((s, i) => <circle key={i} cx={x(i)} cy={y(s)} r="3.5" fill="var(--color-primary)" />)}
    </svg>
  );
}

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("library");
  const p = await progress(user.id);
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: user.timeZone });
  const errors = Object.entries(p.errorTypes).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const recent = [...p.attempts].reverse().slice(0, 20);

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("history")}</h1>
          <p className="mt-1 text-muted">{t("historySubtitle")}</p>
        </div>
        <Link href="/library" className={buttonVariants()}>{t("practiceAgain")}</Link>
      </div>

      {p.attempts.length === 0 ? (
        <EmptyState text={t("noHistory")} />
      ) : (
        <>
          {p.suggestion && <p className="rounded-[var(--radius-md)] bg-primary-soft px-4 py-3 text-primary">{t(`suggestion.${p.suggestion.why}`, { level: p.suggestion.level })}</p>}
          <Card>
            <CardBody><ScoreChart scores={p.attempts.slice(-20).map((a) => a.scorePct ?? 0)} label={t("score")} /></CardBody>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>{t("averages")}</CardTitle></CardHeader>
              <CardBody>
                <dl className="space-y-2 text-sm">
                  {(["EN_FR", "FR_EN"] as const).map((d) => {
                    const v = p.byDirection[d];
                    return (
                      <div key={d} className="flex justify-between">
                        <dt>{t(`directions.${d}`)}</dt>
                        <dd className="font-semibold tabular-nums">{v ? `${Math.round(v.sum / v.n)} %` : "—"}</dd>
                      </div>
                    );
                  })}
                </dl>
              </CardBody>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t("frequentErrors")}</CardTitle></CardHeader>
              <CardBody>
                {errors.length === 0 ? <p className="text-sm text-muted">—</p> : (
                  <ul className="space-y-2 text-sm">
                    {errors.map(([type, n]) => (
                      <li key={type} className="flex justify-between"><span>{t.has(`errorTypes.${type}`) ? t(`errorTypes.${type}`) : type}</span><span className="tabular-nums text-muted">× {n}</span></li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle>{t("attempts")}</CardTitle></CardHeader>
            <CardBody>
              <ul className="divide-y divide-border text-sm">
                {recent.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span>
                      {fmt.format(a.submittedAt ?? a.startedAt)} · {a.test.isTimedExam ? t("examLabel") : t("practiceLabel")} {a.test.level}
                      {a.test.direction && ` · ${t(`directions.${a.test.direction}`)}`}
                    </span>
                    <span className="flex items-center gap-3">
                      {a.passed && <Badge tone="success">✓</Badge>}
                      <b className="tabular-nums">{a.scorePct} %</b>
                      <Link href={`/library/results/${a.id}`} className="text-primary hover:underline">{t("open")}</Link>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

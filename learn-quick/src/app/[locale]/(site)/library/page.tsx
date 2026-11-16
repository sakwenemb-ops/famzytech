import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookOpenText, Timer } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { LEVELS } from "@/lib/grading";
import { getCurrentUser, isVerified } from "@/server/session";
import { getSetting } from "@/server/settings";
import { aiGradingEnabled } from "@/server/library/claude-grader";
import { startExamAction, startPracticeAction } from "@/server/library-actions";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

const TOPICS = ["DAILY_LIFE", "TRAVEL", "HEALTH", "BUSINESS", "LAW", "TECH", "NEWS", "ACADEMIC", "LITERATURE"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "library" });
  return { title: t("title"), description: t("subtitle"), alternates: { languages: { fr: "/fr/library", en: "/en/library" } } };
}

export default async function LibraryPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ empty?: string }> }) {
  const { locale } = await params;
  const { empty } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("library");
  const user = await getCurrentUser();
  const canPractise = Boolean(user && isVerified(user) && (user.role === "STUDENT" || user.role === "TEACHER"));
  const profile = user?.role === "STUDENT" ? await db.studentProfile.findUnique({ where: { userId: user.id } }) : null;
  // Start at the level the student gave for the language they translate into
  const defaultLevel = profile?.frenchLevel ?? profile?.englishLevel ?? "A2";
  const counts = await db.exercise.groupBy({ by: ["level"], where: { status: "PUBLISHED" }, _count: true });
  const perLevel = (l: string) => counts.find((c) => c.level === l)?._count ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold">{t("title")}</h1>
          <p className="mt-2 text-lg text-muted">{t("subtitle")}</p>
        </div>
        {canPractise && <Link href="/library/history" className={buttonVariants({ variant: "secondary" })}>{t("myProgress")}</Link>}
      </div>
      <p className="mt-3 text-sm text-muted">{aiGradingEnabled() ? t("aiNote", { n: await getSetting("libraryAiGradesPerDay") }) : t("basicNote")}</p>
      {empty && <Alert tone="warning" className="mt-4">{t("noMatch")}</Alert>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Quick practice */}
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-6">
          <BookOpenText className="size-6 text-primary" aria-hidden />
          <h2 className="mt-3 text-xl font-semibold">{t("practice")}</h2>
          <p className="mt-1 text-sm text-muted">{t("practiceHint")}</p>
          {canPractise ? (
            <form action={startPracticeAction} className="mt-5 space-y-4">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">{t("direction")}</span>
                <Select name="direction" defaultValue="">
                  <option value="">{t("directions.both")}</option>
                  <option value="EN_FR">{t("directions.EN_FR")}</option>
                  <option value="FR_EN">{t("directions.FR_EN")}</option>
                </Select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">{t("level")}</span>
                  <Select name="level" defaultValue={defaultLevel}>
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </Select>
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">{t("topic")}</span>
                  <Select name="topic" defaultValue="">
                    <option value="">{t("anyTopic")}</option>
                    {TOPICS.map((k) => <option key={k} value={k}>{t(`topics.${k}`)}</option>)}
                  </Select>
                </label>
              </div>
              <Button type="submit" block>{t("start")}</Button>
            </form>
          ) : (
            <Link href="/register" className={buttonVariants({ block: true, className: "mt-5" })}>{t("signInToStart")}</Link>
          )}
        </section>

        {/* Exams */}
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-6">
          <Timer className="size-6 text-primary" aria-hidden />
          <h2 className="mt-3 text-xl font-semibold">{t("exams")}</h2>
          <p className="mt-1 text-sm text-muted">{t("examsHint", { pass: 70 })}</p>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {LEVELS.map((level) => (
              <li key={level} className="rounded-[var(--radius-md)] border border-border p-3">
                <p className="font-semibold">{t("examLevel", { level })}</p>
                <p className="text-xs text-muted">{perLevel(level)} · 30 min</p>
                {canPractise && (
                  <form action={startExamAction.bind(null, level)} className="mt-2">
                    <Button type="submit" size="sm" variant="secondary" block>{t("startExam")}</Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

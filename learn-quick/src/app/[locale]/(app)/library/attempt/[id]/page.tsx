import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/server/session";
import { getAttempt } from "@/server/library/service";
import { AttemptRunner, type RunnerItem } from "@/components/library/attempt-runner";

export default async function AttemptPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser();
  const a = await getAttempt(user, id);
  if (!a || a.userId !== user.id) notFound();
  if (a.status !== "IN_PROGRESS") redirect({ href: `/library/results/${a.id}`, locale: await getLocale() });
  const t = await getTranslations("library");

  const items: RunnerItem[] = a.test.items.map((i) => {
    const ans = a.answers.find((x) => x.itemId === i.id);
    return {
      id: i.id,
      type: i.exercise.type,
      direction: i.exercise.direction,
      level: i.exercise.level,
      sourceText: i.exercise.sourceText,
      gapTemplate: i.exercise.gapTemplate,
      options: ((i.exercise.options ?? []) as { text: string }[]).map((o) => o.text),
      answerText: ans?.answerText ?? "",
      choiceIndex: ans?.choiceIndex ?? null,
      hintUsed: ans?.hintUsed ?? false,
      vocabulary: ans?.hintUsed ? ((i.exercise.keyVocabulary ?? []) as { source: string; target: string }[]) : null,
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{a.test.isTimedExam ? t("examLevel", { level: a.test.level }) : t("practice")}</h1>
      <div className="mt-6">
        <AttemptRunner attemptId={a.id} items={items} deadline={a.deadlineAt?.toISOString() ?? null} />
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/server/session";
import { PrintButton } from "@/components/money/print-button";

export default async function CertificatePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser();
  const a = await db.testAttempt.findUnique({ where: { id }, include: { test: true, user: true } });
  if (!a || !a.passed || !a.certificateNo || (a.userId !== user.id && user.role !== "ADMIN")) notFound();
  const t = await getTranslations("library");
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: a.user.timeZone }).format(a.submittedAt ?? new Date());

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 print:p-0">
      <article className="rounded-[var(--radius-lg)] border-4 border-double border-primary bg-surface p-8 text-center sm:p-12 print:border-primary">
        <p className="text-lg font-semibold text-primary">Learn Quick</p>
        <h1 className="mt-4 text-3xl font-semibold">{t("certTitle")}</h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed">
          {t("certBody", { name: a.user.name, level: a.test.level, score: a.scorePct ?? 0 })}
        </p>
        <p className="mt-8 text-sm text-muted">{t("certDate", { date })} · {t("certNumber", { no: a.certificateNo })}</p>
        <p className="mx-auto mt-6 max-w-lg border-t border-border pt-4 text-xs text-muted">{t("certDisclaimer")}</p>
      </article>
      <div className="mt-4 print:hidden"><PrintButton label={t("print")} /></div>
    </div>
  );
}

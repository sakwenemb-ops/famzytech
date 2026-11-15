import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/session";
import { getLearningDefaults } from "@/server/student";
import { LearningForm } from "@/components/student/learning-form";

export default async function StudentWelcomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");
  const t = await getTranslations("learning");
  const defaults = await getLearningDefaults(user.id);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="text-2xl font-semibold">{t("welcomeTitle")}</h1>
        <p className="mt-1.5 text-muted">{t("welcomeSubtitle")}</p>
        <div className="mt-7">
          <LearningForm defaults={defaults} mode="welcome" />
        </div>
      </div>
    </div>
  );
}

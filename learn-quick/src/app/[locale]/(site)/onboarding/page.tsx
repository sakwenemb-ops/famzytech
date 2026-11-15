import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { dashboardPath, requireUser } from "@/server/session";

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser({ allowNotOnboarded: true, allowUnverified: true });
  if (user.onboarded) redirect({ href: dashboardPath(user.role), locale });
  const t = await getTranslations("auth");

  return (
    <AuthCard title={t("onboardingTitle")} subtitle={t("onboardingSubtitle")}>
      <OnboardingForm />
    </AuthCard>
  );
}

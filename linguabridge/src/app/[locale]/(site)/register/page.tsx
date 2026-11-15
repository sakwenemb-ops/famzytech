import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { GoogleButton } from "@/components/auth/google-button";
import { googleEnabled } from "@/auth";
import { getCurrentUser } from "@/server/session";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("register") };
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { locale } = await params;
  const { role } = await searchParams;
  setRequestLocale(locale);
  if (await getCurrentUser()) redirect({ href: "/dashboard", locale });
  const t = await getTranslations("auth");

  return (
    <AuthCard title={t("registerTitle")} subtitle={t("registerSubtitle")}>
      <RegisterForm defaultRole={role === "TEACHER" ? "TEACHER" : "STUDENT"} />
      {googleEnabled && <GoogleButton />}
      <p className="mt-6 text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("loginButton")}
        </Link>
      </p>
    </AuthCard>
  );
}

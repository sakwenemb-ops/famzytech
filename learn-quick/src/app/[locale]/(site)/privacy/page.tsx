import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { legalInfo, PRIVACY_UPDATED } from "@/lib/legal";
import { privacyPolicy } from "@/content/privacy";
import { LegalPage } from "@/components/legal/legal-page";

// Company details come from the server settings, so read them on each request
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "fr" ? "Politique de confidentialité" : "Privacy policy" };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale === "fr" ? "fr" : "en";
  return <LegalPage policy={privacyPolicy(loc, legalInfo())} updatedIso={PRIVACY_UPDATED} locale={loc} />;
}

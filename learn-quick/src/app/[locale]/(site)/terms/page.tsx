import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { legalInfo, TERMS_UPDATED } from "@/lib/legal";
import { LESSON_MINUTES } from "@/lib/constants";
import { formatXaf } from "@/lib/utils";
import { getSetting } from "@/server/settings";
import { termsOfUse } from "@/content/terms";
import { LegalPage } from "@/components/legal/legal-page";

// The rules (fee, cancellation deadline…) are read live from Admin → Settings
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "fr" ? "Conditions d'utilisation" : "Terms of use" };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale === "fr" ? "fr" : "en";
  const [commissionPct, freeCancelHours, minBookingNoticeHours, slotHoldMinutes, escrowReleaseHours, minPayout, payoutRequiresApproval] = await Promise.all([
    getSetting("commissionPct"),
    getSetting("freeCancelHours"),
    getSetting("minBookingNoticeHours"),
    getSetting("slotHoldMinutes"),
    getSetting("escrowReleaseHours"),
    getSetting("minPayoutXaf"),
    getSetting("payoutRequiresApproval"),
  ]);
  const rules = { commissionPct, freeCancelHours, minBookingNoticeHours, slotHoldMinutes, escrowReleaseHours, minPayoutXaf: formatXaf(minPayout, loc), payoutRequiresApproval, lessonMinutes: LESSON_MINUTES };
  return <LegalPage policy={termsOfUse(loc, legalInfo(), rules)} updatedIso={TERMS_UPDATED} locale={loc} />;
}

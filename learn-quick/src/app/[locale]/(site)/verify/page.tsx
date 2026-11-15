import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { VerifyForm } from "@/components/auth/verify-form";
import { dashboardPath, isVerified, requireUser } from "@/server/session";

/** Show only part of the contact detail on screen. */
function mask(s: string) {
  if (s.includes("@")) {
    const [name, domain] = s.split("@");
    return `${name.slice(0, 2)}•••@${domain}`;
  }
  return `${s.slice(0, 6)} ••• ${s.slice(-3)}`;
}

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ channel?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const user = await requireUser({ allowUnverified: true });
  if (isVerified(user)) redirect({ href: dashboardPath(user.role), locale });

  const t = await getTranslations("auth");
  const channel: "email" | "phone" = sp.channel === "email" && user.email ? "email" : user.phone ? "phone" : "email";
  const to = (channel === "email" ? user.email : user.phone) ?? "";
  const other = channel === "phone" ? (user.email ? "email" : null) : user.phone ? "phone" : null;

  return (
    <AuthCard
      title={t("verifyTitle", { channel: t(channel === "phone" ? "channelPhone" : "channelEmail") })}
      subtitle={t("verifySubtitle", { to: mask(to) })}
    >
      <VerifyForm key={channel} channel={channel} />
      {other && (
        <Link href={{ pathname: "/verify", query: { channel: other } }} className="mt-2 inline-block text-sm text-muted hover:text-fg">
          {other === "email" ? t("useEmail") : t("usePhone")}
        </Link>
      )}
    </AuthCard>
  );
}

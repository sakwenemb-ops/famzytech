import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck, CalendarClock, IdCard, Laptop, Smartphone, Video, Wallet, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatXaf } from "@/lib/utils";
import { getSetting } from "@/server/settings";
import { getCurrentUser } from "@/server/session";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "becomeTeacher" });
  return { title: t("metaTitle"), description: t("subtitle") };
}

export default async function BecomeTeacherPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("becomeTeacher");
  const loc = locale as "en" | "fr";
  const [commission, reviewDays, escrowHours, user] = await Promise.all([getSetting("commissionPct"), getSetting("applicationReviewDays"), getSetting("escrowReleaseHours"), getCurrentUser()]);
  const example = 5000;
  const cta =
    user?.role === "TEACHER" ? { href: "/teacher/application", label: t("ctaContinue") } : user ? null : { href: "/register?role=TEACHER", label: t("cta") };

  const benefits = [
    { icon: Wallet, title: t("b1"), text: t("b1Text") },
    { icon: CalendarClock, title: t("b2"), text: t("b2Text") },
    { icon: Users, title: t("b3"), text: t("b3Text") },
    { icon: BadgeCheck, title: t("b4"), text: t("b4Text") },
  ];
  const needs = [
    { icon: IdCard, text: t("n1") },
    { icon: BadgeCheck, text: t("n2") },
    { icon: Video, text: t("n3") },
    { icon: Laptop, text: t("n4") },
    { icon: Smartphone, text: t("n5") },
  ];
  const steps = [t("s1"), t("s2"), t("s3", { days: reviewDays }), t("s4")];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:py-16">
      <section className="max-w-2xl">
        <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-5xl">{t("title")}</h1>
        <p className="mt-4 text-lg text-muted">{t("subtitle")}</p>
        {cta ? (
          <Link href={cta.href} className={buttonVariants({ size: "lg", className: "mt-6" })}>{cta.label}</Link>
        ) : (
          <p className="mt-6 rounded-[var(--radius-md)] bg-surface-2 px-4 py-3 text-sm">{t("otherRole")}</p>
        )}
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-2" aria-label={t("benefitsTitle")}>
        {benefits.map((b) => (
          <div key={b.title} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <b.icon className="size-5 text-primary" aria-hidden />
            <h2 className="mt-3 font-semibold">{b.title}</h2>
            <p className="mt-1 text-sm text-muted">{b.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-14 rounded-[var(--radius-lg)] bg-primary-soft p-6 md:p-8">
        <h2 className="text-xl font-semibold">{t("earningsTitle")}</h2>
        <p className="mt-2 text-[15px]">
          {t("earningsText", { price: formatXaf(example, loc), fee: commission, net: formatXaf(Math.round(example * (1 - commission / 100)), loc), hours: escrowHours })}
        </p>
      </section>

      <div className="mt-14 grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="text-xl font-semibold">{t("needTitle")}</h2>
          <ul className="mt-4 space-y-3">
            {needs.map((n) => (
              <li key={n.text} className="flex gap-3 text-[15px]"><n.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />{n.text}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-semibold">{t("stepsTitle")}</h2>
          <ol className="mt-4 space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-[15px]">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-white">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="mt-14">
        <h2 className="text-xl font-semibold">{t("faqTitle")}</h2>
        <div className="mt-4 divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
          {(["q1", "q2", "q3", "q4"] as const).map((q) => (
            <details key={q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">{t(`${q}`)}</summary>
              <p className="mt-2 text-[15px] text-muted">{t(`${q}a`, { fee: commission, hours: escrowHours })}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          {t.rich("termsNote", { link: (c) => <Link href="/terms#s8" className="text-primary hover:underline">{c}</Link> })}
        </p>
      </section>

      {cta && (
        <section className="mt-14 text-center">
          <Link href={cta.href} className={buttonVariants({ size: "lg" })}>{cta.label}</Link>
        </section>
      )}
    </div>
  );
}

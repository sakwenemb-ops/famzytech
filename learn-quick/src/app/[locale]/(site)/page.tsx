import { getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck, BookOpenText, Smartphone, Video } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  const features = [
    { key: "verified", icon: BadgeCheck },
    { key: "money", icon: Smartphone },
    { key: "classroom", icon: Video },
    { key: "library", icon: BookOpenText },
  ] as const;

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 md:grid-cols-[1.15fr_1fr] md:items-center md:pt-20">
        <div>
          <p className="mb-4 text-sm font-medium text-primary">{t("eyebrow")}</p>
          <h1 className="text-[2.15rem] font-semibold leading-[1.1] sm:text-5xl">{t("title")}</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">{t("subtitle")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/teachers" className={buttonVariants({ size: "lg" })}>
              {t("ctaStudent")}
            </Link>
            <Link href="/become-a-teacher" className={buttonVariants({ size: "lg", variant: "secondary" })}>
              {t("ctaTeacher")}
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-3 text-sm text-muted">
            <span>{t("payWith")}</span>
            <span className="rounded-full bg-mtn px-3 py-1 text-xs font-semibold text-black">MTN MoMo</span>
            <span className="rounded-full bg-orange px-3 py-1 text-xs font-semibold text-black">Orange Money</span>
          </div>
        </div>

        {/* A lesson card preview, built from real UI rather than stock imagery */}
        <div aria-hidden className="relative">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
            <div className="grid aspect-video grid-cols-2 gap-2">
              <div className="flex items-end rounded-[var(--radius-md)] bg-primary-soft p-3">
                <span className="rounded bg-surface/80 px-2 py-0.5 text-xs font-medium">Teacher · Yaoundé</span>
              </div>
              <div className="flex items-end rounded-[var(--radius-md)] bg-accent-soft p-3">
                <span className="rounded bg-surface/80 px-2 py-0.5 text-xs font-medium">Student · Douala</span>
              </div>
            </div>
            <div className="mt-4 rounded-[var(--radius-md)] bg-surface-2 p-3 text-sm">
              <p className="text-muted">EN → FR · B1</p>
              <p className="mt-1">“I have been living here for two years.”</p>
              <p className="mt-1 font-medium text-success">« J&apos;habite ici depuis deux ans. » ✓</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-border bg-surface">
        <dl className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-sm sm:grid-cols-3">
          {(["verified", "levels", "payments"] as const).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <BadgeCheck className="size-4 shrink-0 text-success" aria-hidden />
              <dt className="font-medium">{t(`stats.${k}`)}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 pt-20">
        <h2 className="text-2xl font-semibold sm:text-3xl">{t("howTitle")}</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {(["1", "2", "3"] as const).map((n) => (
            <li key={n} className="flex gap-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary">{n}</span>
              <div>
                <h3 className="font-semibold">{t(`steps.${n}.title`)}</h3>
                <p className="mt-1 text-[15px] text-muted">{t(`steps.${n}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <h2 className="text-2xl font-semibold sm:text-3xl">{t("featuresTitle")}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {features.map(({ key, icon: Icon }) => (
            <div key={key} className="rounded-[var(--radius-lg)] border border-border bg-surface p-6">
              <Icon className="size-6 text-primary" aria-hidden />
              <h3 className="mt-4 font-semibold">{t(`features.${key}.title`)}</h3>
              <p className="mt-1.5 text-[15px] text-muted">{t(`features.${key}.body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Teacher CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <div className="flex flex-col gap-6 rounded-[var(--radius-lg)] bg-primary p-8 text-primary-fg sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold">{t("teacherTitle")}</h2>
            <p className="mt-2 opacity-90">{t("teacherBody")}</p>
          </div>
          <Link href="/register?role=TEACHER" className={buttonVariants({ size: "lg", variant: "secondary", className: "shrink-0" })}>
            {t("teacherCta")}
          </Link>
        </div>
      </section>
    </>
  );
}

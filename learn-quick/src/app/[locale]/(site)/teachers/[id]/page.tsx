import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck, GraduationCap, MapPin, ScrollText } from "lucide-react";
import type { BadgeType } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatXaf } from "@/lib/utils";
import { COUNTRIES } from "@/lib/countries";
import { LESSON_MINUTES } from "@/lib/constants";
import { getCurrentUser, isVerified } from "@/server/session";
import { getTeacherProfile, localized } from "@/server/teachers";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Stars } from "@/components/ui/stars";
import { FavoriteButton } from "@/components/teacher/favorite-button";
import { BookingWidget } from "@/components/booking/booking-widget";
import { packWithCredit, priceFor, trialAvailable, type BookingOption } from "@/server/booking";

type Params = { params: Promise<{ locale: string; id: string }> };

const BADGE_ORDER: BadgeType[] = ["VERIFIED_ID", "CERTIFIED", "PROFESSIONAL", "TOP_RATED"];

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, id } = await params;
  const teacher = await getTeacherProfile(id);
  if (!teacher?.isPublished) return { robots: { index: false } };
  const to = await getTranslations({ locale, namespace: "options" });
  const subjects = teacher.subjects.map((s) => to(`languages.${s}`)).join(" · ");
  const headline = localized(locale, teacher.headlineEn, teacher.headlineFr)?.text;
  return {
    title: `${teacher.user.name} · ${subjects}`,
    description: headline ?? undefined,
    alternates: { languages: { fr: `/fr/teachers/${id}`, en: `/en/teachers/${id}` } },
    openGraph: { images: teacher.photoUrl ? [teacher.photoUrl] : undefined },
  };
}

export default async function TeacherProfilePage({ params }: Params) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const [teacher, viewer] = await Promise.all([getTeacherProfile(id), getCurrentUser()]);

  // Unpublished profiles: only the teacher themself and admins may look (as a preview)
  const isOwner = viewer?.id === teacher?.user.id;
  const isAdmin = viewer?.role === "ADMIN";
  if (!teacher || teacher.user.status !== "ACTIVE" || (!teacher.isPublished && !isOwner && !isAdmin)) notFound();

  const t = await getTranslations("teacherProfile");
  const to = await getTranslations("options");
  const format = await getFormatter();
  const loc = locale as "en" | "fr";

  const studentProfile =
    viewer?.role === "STUDENT" && isVerified(viewer)
      ? await db.studentProfile.findUnique({ where: { userId: viewer.id }, select: { id: true } })
      : null;
  const isSaved = studentProfile
    ? Boolean(await db.favoriteTeacher.findUnique({ where: { studentId_teacherId: { studentId: studentProfile.id, teacherId: teacher.id } } }))
    : false;

  // Booking options: trial (first lesson with this teacher only), single lesson, packs
  const canTrial = teacher.trialRateXaf != null && (!studentProfile || (await trialAvailable(studentProfile.id, teacher.id)));
  const credit = studentProfile ? await packWithCredit(studentProfile.id, teacher.id) : null;
  const bookingOptions = ([...(canTrial ? ["TRIAL"] : []), "SINGLE", "PACK_5", "PACK_10", "PACK_20"] as BookingOption[]).map((o) => ({ option: o, ...priceFor(teacher, o) }));

  const headline = localized(locale, teacher.headlineEn, teacher.headlineFr);
  const bio = localized(locale, teacher.bioEn, teacher.bioFr);
  const experience = localized(locale, teacher.experienceEn, teacher.experienceFr);
  const otherLanguage = to(`languages.${locale === "fr" ? "ENGLISH" : "FRENCH"}`).toLowerCase();
  const country = COUNTRIES.find((c) => c.code === teacher.user.country)?.name[loc] ?? teacher.user.country;
  const spoken = (Array.isArray(teacher.spokenLanguages) ? teacher.spokenLanguages : []) as { language: string; level: string }[];
  const langName = (l: string) => (to.has(`languages.${l}`) ? to(`languages.${l}`) : l);
  const badges = BADGE_ORDER.filter((b) => teacher.badges.some((x) => x.type === b));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      {!teacher.isPublished && <Alert tone="warning" className="mb-6">{t("notPublishedPreview")}</Alert>}

      {/* Phone order: header, price box, details. Desktop: price box in a sticky right column. */}
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 lg:col-start-1">
          {/* Header */}
          <header className="flex gap-4 sm:gap-6">
            <Avatar name={teacher.user.name} src={teacher.photoUrl} size={80} />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold sm:text-3xl">{teacher.user.name}</h1>
              {headline && <p className="mt-1 text-[15px] text-muted sm:text-base">{headline.text}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-1 text-muted">
                  <MapPin className="size-4" aria-hidden />
                  {teacher.user.city ? `${teacher.user.city}, ${country}` : country}
                </span>
                {teacher.ratingCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Stars value={teacher.ratingAvg} label={`${teacher.ratingAvg.toFixed(1)} / 5`} />
                    <span className="font-medium">{format.number(teacher.ratingAvg, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}</span>
                    <span className="text-muted">({t("reviewsCount", { count: teacher.ratingCount })})</span>
                  </span>
                ) : (
                  <Badge tone="primary">{t("newTeacher")}</Badge>
                )}
                <span className="text-muted">{t("lessonsDone", { count: teacher.lessonsCompleted })}</span>
              </div>
              {badges.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {badges.map((b) => (
                    <li key={b}>
                      <Badge tone={b === "TOP_RATED" ? "warning" : "success"} title={t(`badgeHelp.${b}`)}>
                        <BadgeCheck className="size-3.5" aria-hidden />
                        {to(`badges.${b}`)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </header>
        </div>

        {/* Price and actions */}
        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
            {teacher.hourlyRateXaf != null && (
              <>
                <p className="text-2xl font-semibold tabular-nums">{formatXaf(teacher.hourlyRateXaf, loc)}</p>
                <p className="text-sm text-muted">{t("perLesson", { minutes: LESSON_MINUTES })}</p>
              </>
            )}
            {teacher.trialRateXaf != null && (
              <p className="mt-3 flex items-center justify-between rounded-[var(--radius-md)] bg-accent-soft px-3 py-2 text-sm">
                <span>{t("trial")}</span>
                <span className="font-semibold tabular-nums">{formatXaf(teacher.trialRateXaf, loc)}</span>
              </p>
            )}
            <div className="mt-5 border-t border-border pt-5">
              {teacher.isPublished ? (
                <BookingWidget
                  teacherId={teacher.id}
                  viewer={!viewer ? "anon" : viewer.role === "STUDENT" ? "student" : "other"}
                  timeZone={viewer?.timeZone ?? null}
                  creditsLeft={credit ? credit.totalLessons - credit.usedLessons : 0}
                  options={bookingOptions}
                />
              ) : (
                <p className="text-sm text-muted">{t("bookingSoon")}</p>
              )}
            </div>
            {studentProfile ? (
              <div className="mt-3"><FavoriteButton teacherId={teacher.id} initialSaved={isSaved} /></div>
            ) : !viewer ? (
              <Link href="/login" className={buttonVariants({ variant: "ghost", block: true, className: "mt-3" })}>
                {t("loginToSave")}
              </Link>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0 space-y-8 lg:col-start-1">
          {/* Languages */}
          <dl className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">{t("teaches")}</dt>
              <dd className="mt-1 font-medium">{teacher.subjects.map((s) => to(`languages.${s}`)).join(", ")}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("speaks")}</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {spoken.map((s) => (
                  <Badge key={s.language}>
                    {langName(s.language)} · {s.level === "NATIVE" ? t("native") : s.level}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>

          {teacher.videoUrl && (
            <section aria-labelledby="video-h">
              <h2 id="video-h" className="sr-only">{t("video")}</h2>
              <video
                src={teacher.videoUrl}
                controls
                preload="none"
                playsInline
                poster={teacher.photoUrl ?? undefined}
                className="aspect-video w-full rounded-[var(--radius-lg)] bg-black"
              />
            </section>
          )}

          {bio && (
            <section>
              <h2 className="text-lg font-semibold">{t("about")}</h2>
              {bio.fallback && <p className="mt-1 text-xs text-muted">{t("translatedNote", { language: otherLanguage })}</p>}
              <p className="mt-2 whitespace-pre-line leading-relaxed">{bio.text}</p>
            </section>
          )}

          {experience && (
            <section>
              <h2 className="text-lg font-semibold">{t("experience")}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed">{experience.text}</p>
            </section>
          )}

          {teacher.specialties.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">{t("specialties")}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {teacher.specialties.map((s) => (
                  <li key={s} className="rounded-full border border-border bg-surface px-3 py-1 text-sm">
                    {to.has(`specialties.${s}`) ? to(`specialties.${s}`) : s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(teacher.certificates.length > 0 || teacher.educations.length > 0) && (
            <section className="grid gap-6 sm:grid-cols-2">
              {teacher.certificates.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold">{t("certificates")}</h2>
                  <ul className="mt-3 space-y-3">
                    {teacher.certificates.map((c) => (
                      <li key={c.id} className="flex gap-3 text-sm">
                        <ScrollText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-muted">{[c.issuer, c.yearTo ?? c.yearFrom].filter(Boolean).join(" · ")}</p>
                          <p className="text-xs text-success">{t("verifiedDoc")}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {teacher.educations.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold">{t("education")}</h2>
                  <ul className="mt-3 space-y-3">
                    {teacher.educations.map((e) => (
                      <li key={e.id} className="flex gap-3 text-sm">
                        <GraduationCap className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <div>
                          <p className="font-medium">{e.degree}, {e.field}</p>
                          <p className="text-muted">{[e.university, e.yearTo ?? e.yearFrom].filter(Boolean).join(" · ")}</p>
                          <p className="text-xs text-success">{t("verifiedDoc")}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Reviews */}
          <section>
            <h2 className="text-lg font-semibold">{t("reviews")}</h2>
            {teacher.reviews.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{t("noReviews")}</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {teacher.reviews.map((r) => (
                  <li key={r.id} className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.student.user.name} size={32} />
                        {/* Only the first name, for the student's privacy */}
                        <span className="text-sm font-medium">{r.student.user.name.split(" ")[0]}</span>
                      </div>
                      <span className="text-xs text-muted">{format.dateTime(r.createdAt, { month: "long", year: "numeric" })}</span>
                    </div>
                    <Stars value={r.rating} label={`${r.rating} / 5`} className="mt-2" />
                    {r.comment && <p className="mt-2 text-[15px] leading-relaxed">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Lock, XCircle } from "lucide-react";
import type { ApplicationSection } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LESSON_MINUTES } from "@/lib/constants";
import { requireRole } from "@/server/session";
import {
  DESCRIPTION_LIMITS,
  PRICE_LIMITS,
  STEPS,
  canEdit,
  completedSteps,
  currentReviews,
  feedbackReviews,
  loadTeacherApplication,
  stepFromSlug,
  stepSlug,
} from "@/server/application";
import { getSetting } from "@/server/settings";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { AboutStep } from "@/components/application/steps/about";
import { MediaStep } from "@/components/application/steps/media";
import { QualificationsStep } from "@/components/application/steps/qualifications";
import { DescriptionStep } from "@/components/application/steps/description";
import { AvailabilityStep } from "@/components/application/steps/availability";
import { PricingStep } from "@/components/application/steps/pricing";
import { IdentityStep } from "@/components/application/steps/identity";
import { AgreementStep } from "@/components/application/steps/agreement";

type Params = { params: Promise<{ locale: string; step: string }> };

export default async function ApplicationStepPage({ params }: Params) {
  const { locale, step: slug } = await params;
  setRequestLocale(locale);
  const step = stepFromSlug(slug);
  if (!step) notFound();

  const user = await requireRole("TEACHER");
  const t = (await loadTeacherApplication({ userId: user.id }))!;
  const a = t.application!;
  const tr = await getTranslations("application");
  const td = await getTranslations("dashboard");
  const commissionPct = await getSetting("commissionPct");

  const done = completedSteps(t);
  const reviews = currentReviews(t);
  const feedback = feedbackReviews(t);
  const editable = canEdit(step, t);
  const index = STEPS.indexOf(step);
  const prev = STEPS[index - 1];
  const next = STEPS[index + 1];
  const review = a.status === "CHANGES_REQUESTED" || a.status === "REJECTED" ? reviews.get(step) : undefined;
  const comment = feedback.get(step)?.comment;

  const stepState = (s: ApplicationSection) => {
    const d = reviews.get(s)?.decision;
    if (a.status === "CHANGES_REQUESTED" && d === "NEEDS_CHANGES") return "fix";
    if (a.status === "REJECTED" && d === "REJECTED") return "rejected";
    if (done.includes(s)) return "done";
    return "todo";
  };

  const content = (() => {
    switch (step) {
      case "ABOUT":
        return (
          <AboutStep
            defaults={{
              subjects: t.subjects,
              spoken: (Array.isArray(t.spokenLanguages) ? t.spokenLanguages : []) as { language: string; level: string }[],
              countryOfBirth: t.countryOfBirth,
            }}
          />
        );
      case "PHOTO":
        return <MediaStep type="photo" name={user.name} current={t.photoUrl} />;
      case "VIDEO":
        return <MediaStep type="video" name={user.name} current={t.videoUrl} />;
      case "CERTIFICATION":
        return (
          <QualificationsStep
            type="certificate"
            none={a.noCertificate}
            items={t.certificates.map((c) => ({
              id: c.id,
              title: c.name,
              detail: [c.issuer, [c.yearFrom, c.yearTo].filter(Boolean).join("–")].filter(Boolean).join(" · "),
              fileUrl: c.documentId ? `/api/files/${c.documentId}` : null,
            }))}
          />
        );
      case "EDUCATION":
        return (
          <QualificationsStep
            type="education"
            none={a.noEducation}
            items={t.educations.map((e) => ({
              id: e.id,
              title: `${e.degree}, ${e.field}`,
              detail: [e.university, [e.yearFrom, e.yearTo].filter(Boolean).join("–")].filter(Boolean).join(" · "),
              fileUrl: e.documentId ? `/api/files/${e.documentId}` : null,
            }))}
          />
        );
      case "DESCRIPTION":
        return (
          <DescriptionStep
            limits={DESCRIPTION_LIMITS}
            specialties={t.specialties}
            defaults={{
              headlineEn: t.headlineEn ?? "",
              headlineFr: t.headlineFr ?? "",
              bioEn: t.bioEn ?? "",
              bioFr: t.bioFr ?? "",
              experienceEn: t.experienceEn ?? "",
              experienceFr: t.experienceFr ?? "",
            }}
          />
        );
      case "AVAILABILITY":
        return <AvailabilityStep timeZone={user.timeZone} defaults={t.availability.map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin }))} />;
      case "PRICING":
        return (
          <PricingStep
            commissionPct={commissionPct}
            lessonMinutes={LESSON_MINUTES}
            limits={PRICE_LIMITS}
            defaults={{
              hourlyRateXaf: t.hourlyRateXaf,
              trialRateXaf: t.trialRateXaf,
              package5Discount: t.package5Discount,
              package10Discount: t.package10Discount,
              package20Discount: t.package20Discount,
            }}
          />
        );
      case "IDENTITY":
        return <IdentityStep defaults={{ idDocumentType: a.idDocumentType, idFrontDocId: a.idFrontDocId, idBackDocId: a.idBackDocId, idSelfieDocId: a.idSelfieDocId }} />;
      case "AGREEMENT":
        return (
          <AgreementStep
            resubmission={a.status === "CHANGES_REQUESTED"}
            missing={STEPS.filter((s) => s !== "AGREEMENT" && !done.includes(s)).map((s) => ({ slug: stepSlug(s), title: tr(`sections.${s}.title`) }))}
          />
        );
    }
  })();

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 md:grid-cols-[240px_1fr] md:py-10">
      {/* Step list */}
      <nav aria-label={tr("title")} className="min-w-0 md:sticky md:top-24 md:self-start">
        <Link href="/teacher" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ChevronLeft className="size-4" aria-hidden />
          {td("overview")}
        </Link>
        <ol className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
          {STEPS.map((s, i) => {
            const st = stepState(s);
            const active = s === step;
            return (
              <li key={s} className="shrink-0">
                <Link
                  href={`/teacher/application/${stepSlug(s)}`}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-sm",
                    active ? "bg-primary-soft font-medium text-primary" : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      st === "done" && "bg-success text-white",
                      st === "fix" && "bg-warning text-white",
                      st === "rejected" && "bg-danger text-white",
                      st === "todo" && "border border-border bg-surface",
                    )}
                  >
                    {st === "done" ? <Check className="size-3.5" aria-label={tr("done")} /> : st === "fix" ? <AlertTriangle className="size-3.5" aria-label={tr("needsChanges")} /> : st === "rejected" ? <XCircle className="size-3.5" aria-label={tr("rejected")} /> : i + 1}
                  </span>
                  <span className="whitespace-nowrap">{tr(`sections.${s}.title`)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Current step */}
      <section className="min-w-0">
        <p className="text-sm text-muted">{tr("stepOf", { n: index + 1, total: STEPS.length })}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{tr(`sections.${step}.title`)}</h1>
          {review?.decision === "NEEDS_CHANGES" && <Badge tone="warning">{tr("needsChanges")}</Badge>}
          {review?.decision === "APPROVED" && <Badge tone="success">{tr("approved")}</Badge>}
          {review?.decision === "REJECTED" && <Badge tone="danger">{tr("rejected")}</Badge>}
        </div>
        <p className="mt-1 text-muted">{tr(`sections.${step}.desc`)}</p>

        {a.status !== "DRAFT" && a.status !== "CHANGES_REQUESTED" && step === "AGREEMENT" ? (
          <Alert tone={a.status === "APPROVED" ? "success" : a.status === "REJECTED" ? "danger" : "info"} className="mt-6">
            {tr(`status.${a.status}`)}
          </Alert>
        ) : null}

        {comment && (
          <div className="mt-6 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft p-4">
            <p className="text-sm font-semibold text-warning">{tr("reviewerSays")}</p>
            <p className="mt-1 whitespace-pre-line text-[15px]">{comment}</p>
          </div>
        )}
        {!editable && step !== "AGREEMENT" && (
          <Alert tone={review?.decision === "APPROVED" ? "success" : "info"} className="mt-6 flex items-center gap-2">
            <Lock className="size-4 shrink-0" aria-hidden />
            {review?.decision === "APPROVED" ? tr("lockedApproved") : tr("locked")}
          </Alert>
        )}

        <div className="mt-6 rounded-[var(--radius-lg)] border border-border bg-surface p-5 sm:p-6">
          {/* A disabled fieldset turns every input and button inside it off */}
          {(step !== "AGREEMENT" || editable) && (
            <fieldset disabled={!editable} className="min-w-0 disabled:opacity-70">
              {content}
            </fieldset>
          )}
          {step === "AGREEMENT" && !editable && (
            <p className="text-sm text-muted">{tr("agreement.reviewTime")}</p>
          )}
        </div>

        <div className="mt-5 flex justify-between text-sm">
          {prev ? (
            <Link href={`/teacher/application/${stepSlug(prev)}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              <ChevronLeft className="size-4" aria-hidden />
              {tr(`sections.${prev}.title`)}
            </Link>
          ) : <span />}
          {next && (step === "PHOTO" || step === "VIDEO" || step === "CERTIFICATION" || step === "EDUCATION" || !editable) && (
            <Link href={`/teacher/application/${stepSlug(next)}`} className={buttonVariants({ variant: done.includes(step) ? "primary" : "secondary", size: "sm" })}>
              {tr(`sections.${next}.title`)}
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

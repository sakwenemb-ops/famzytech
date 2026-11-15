import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft, ExternalLink } from "lucide-react";
import type { ApplicationSection } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatXaf } from "@/lib/utils";
import { COUNTRIES } from "@/lib/countries";
import { requireRole } from "@/server/session";
import { REVIEW_SECTIONS, completedSteps, currentReviews, loadTeacherApplication } from "@/server/application";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { SectionReview } from "@/components/admin/section-review";
import { FinalDecisionPanel, StartReviewButton } from "@/components/admin/final-decision";
import { statusTone } from "@/components/admin/status";

const decisionTone = { PENDING: "neutral", APPROVED: "success", NEEDS_CHANGES: "warning", REJECTED: "danger" } as const;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function FileLink({ id, label, mime }: { id: string | null | undefined; label: string; mime?: string }) {
  if (!id) return null;
  const url = `/api/files/${id}`;
  return mime?.startsWith("image/") ? (
    <a href={url} target="_blank" rel="noreferrer" className="block w-fit">
      {/* eslint-disable-next-line @next/next/no-img-element -- private file served by our API */}
      <img src={url} alt={label} className="max-h-56 rounded-[var(--radius-md)] border border-border" />
    </a>
  ) : (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
      {label} <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

function Pair({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-1.5 text-sm sm:grid-cols-[180px_1fr]">
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 whitespace-pre-line break-words">{v || "—"}</dd>
    </div>
  );
}

export default async function ReviewPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const app = await db.teacherApplication.findUnique({ where: { id } });
  if (!app) notFound();
  const t = (await loadTeacherApplication({ id: app.teacherId }))!;
  const a = t.application!;

  const tr = await getTranslations("review");
  const ta = await getTranslations("application");
  const td = await getTranslations("dashboard");
  const ts = await getTranslations("settings");
  const to = await getTranslations("options");
  const format = await getFormatter();
  const loc = locale as "en" | "fr";

  const reviews = currentReviews(t);
  const previous = new Map(a.reviews.filter((r) => r.round === a.round - 1 && r.comment).map((r) => [r.section, r]));
  const reviewing = a.status === "UNDER_REVIEW";
  const reviewed = REVIEW_SECTIONS.filter((s) => reviews.get(s)).length;
  const done = completedSteps(t);
  const docs = await db.document.findMany({
    where: { id: { in: [a.idFrontDocId, a.idBackDocId, a.idSelfieDocId].filter((x): x is string => Boolean(x)) } },
    select: { id: true, mimeType: true },
  });
  const mime = (docId: string | null) => docs.find((d) => d.id === docId)?.mimeType;
  const spoken = (Array.isArray(t.spokenLanguages) ? t.spokenLanguages : []) as { language: string; level: string }[];
  const langName = (l: string) => (to.has(`languages.${l}`) ? to(`languages.${l}`) : l);
  const country = (c: string | null) => (c ? (COUNTRIES.find((x) => x.code === c)?.name[loc] ?? c) : null);

  const body = (s: ApplicationSection) => {
    switch (s) {
      case "ABOUT":
        return (
          <dl>
            <Pair k={tr("subjects")} v={t.subjects.map(langName).join(", ")} />
            <Pair k={ta("about.spoken")} v={spoken.map((r) => `${langName(r.language)} · ${r.level === "NATIVE" ? ta("about.native") : r.level}`).join("\n")} />
            <Pair k={ta("about.countryOfBirth")} v={country(t.countryOfBirth)} />
          </dl>
        );
      case "PHOTO":
        return t.photoUrl ? <Avatar name={t.user.name} src={t.photoUrl} size={160} className="rounded-[var(--radius-md)]" /> : <p className="text-sm text-muted">{tr("noFile")}</p>;
      case "VIDEO":
        return t.videoUrl ? <video src={t.videoUrl} controls preload="metadata" className="aspect-video w-full max-w-lg rounded-[var(--radius-md)] bg-black" /> : <p className="text-sm text-muted">{tr("noFile")}</p>;
      case "CERTIFICATION":
        return a.noCertificate && !t.certificates.length ? (
          <p className="text-sm">{tr("noCertificate")}</p>
        ) : (
          <ul className="space-y-3">
            {t.certificates.map((c) => (
              <li key={c.id} className="text-sm">
                <p className="font-medium">{c.name}</p>
                <p className="text-muted">{[c.issuer, [c.yearFrom, c.yearTo].filter(Boolean).join("–")].filter(Boolean).join(" · ")}</p>
                <FileLink id={c.documentId} label={tr("openFile")} mime={c.document?.mimeType} />
              </li>
            ))}
          </ul>
        );
      case "EDUCATION":
        return a.noEducation && !t.educations.length ? (
          <p className="text-sm">{tr("noEducation")}</p>
        ) : (
          <ul className="space-y-3">
            {t.educations.map((e) => (
              <li key={e.id} className="text-sm">
                <p className="font-medium">{e.degree}, {e.field}</p>
                <p className="text-muted">{[e.university, [e.yearFrom, e.yearTo].filter(Boolean).join("–")].filter(Boolean).join(" · ")}</p>
                {e.documentId ? <FileLink id={e.documentId} label={tr("openFile")} mime={e.document?.mimeType} /> : <p className="text-muted">{tr("noFile")}</p>}
              </li>
            ))}
          </ul>
        );
      case "DESCRIPTION":
        return (
          <dl>
            <Pair k={ta("desc.headlineEn")} v={t.headlineEn} />
            <Pair k={ta("desc.headlineFr")} v={t.headlineFr} />
            <Pair k={ta("desc.bioEn")} v={t.bioEn} />
            <Pair k={ta("desc.bioFr")} v={t.bioFr} />
            <Pair k={ta("desc.experienceEn")} v={t.experienceEn} />
            <Pair k={ta("desc.experienceFr")} v={t.experienceFr} />
            <Pair k={ta("desc.specialties")} v={t.specialties.map((x) => (to.has(`specialties.${x}`) ? to(`specialties.${x}`) : x)).join(", ")} />
          </dl>
        );
      case "AVAILABILITY": {
        const f = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
        return (
          <dl>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const slots = t.availability.filter((s) => s.weekday === d);
              return slots.length ? (
                <Pair key={d} k={f.format(new Date(Date.UTC(2023, 0, 1 + d)))} v={slots.map((s) => `${hhmm(s.startMin)}–${hhmm(s.endMin)}`).join(", ")} />
              ) : null;
            })}
            <Pair k={ts("timeZone")} v={t.user.timeZone.replaceAll("_", " ")} />
          </dl>
        );
      }
      case "PRICING":
        return (
          <dl>
            <Pair k={ta("pricing.rate")} v={t.hourlyRateXaf != null ? formatXaf(t.hourlyRateXaf, loc) : null} />
            <Pair k={ta("pricing.trial")} v={t.trialRateXaf != null ? formatXaf(t.trialRateXaf, loc) : null} />
            <Pair k={ta("pricing.packages")} v={`${t.package5Discount}% · ${t.package10Discount}% · ${t.package20Discount}%`} />
          </dl>
        );
      case "IDENTITY":
        return (
          <div className="space-y-3">
            <dl>
              <Pair k={ta("identity.type")} v={a.idDocumentType ? ta(`identity.types.${a.idDocumentType}`) : null} />
            </dl>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["idFrontDocId", "idBackDocId", "idSelfieDocId"] as const).map((k, i) =>
                a[k] ? (
                  <div key={k}>
                    <p className="mb-1 text-xs text-muted">{ta(`identity.${["front", "back", "selfie"][i]}`)}</p>
                    <FileLink id={a[k]} label={tr("openFile")} mime={mime(a[k])} />
                  </div>
                ) : null,
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      <Link href="/admin/applications" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden />
        {tr("back")}
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <Avatar name={t.user.name} src={t.photoUrl} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{t.user.name}</h1>
          <p className="text-sm text-muted">
            {[t.user.email, t.user.phone].filter(Boolean).join(" · ")}
            {a.submittedAt && ` · ${tr("submitted")} ${format.dateTime(a.submittedAt, { dateStyle: "medium" })}`} · {tr("round", { n: a.round })}
          </p>
        </div>
        <Badge tone={statusTone[a.status]}>{tr(`status.${a.status}`)}</Badge>
        <Link href={`/teachers/${t.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>{tr("previewProfile")}</Link>
      </header>

      {a.status === "SUBMITTED" && (
        <Card className="mt-6">
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">{tr("startHint")}</p>
            <StartReviewButton applicationId={a.id} />
          </CardBody>
        </Card>
      )}
      {a.status === "DRAFT" && (
        <Alert tone="info" className="mt-6">{td("teacher.statusHelp.DRAFT")} ({done.length}/10)</Alert>
      )}

      <div className="mt-6 space-y-4">
        {REVIEW_SECTIONS.map((s) => {
          const r = reviews.get(s);
          const prev = previous.get(s);
          return (
            <Card key={s} id={s.toLowerCase()}>
              <CardBody className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{ta(`sections.${s}.title`)}</h2>
                  <Badge tone={decisionTone[(r?.decision ?? "PENDING") as keyof typeof decisionTone]}>{tr(`decided.${r?.decision ?? "PENDING"}`)}</Badge>
                </div>
                {prev && (
                  <p className="rounded-[var(--radius-md)] bg-surface-2 px-3 py-2 text-sm">
                    <span className="font-medium">{tr("previousRound", { n: a.round - 1 })}:</span> {prev.comment}
                  </p>
                )}
                {body(s)}
                {!reviewing && r?.comment && <p className="text-sm text-muted">“{r.comment}”</p>}
                <SectionReview
                  key={`${s}-${r?.decision}-${r?.comment}`}
                  applicationId={a.id}
                  section={s}
                  enabled={reviewing}
                  current={r ? { decision: r.decision, comment: r.comment } : null}
                />
              </CardBody>
            </Card>
          );
        })}
      </div>

      {reviewing && (
        <Card className="mt-6 border-primary/30">
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{tr("final")}</h2>
              <span className="text-sm text-muted">{tr("progress", { done: reviewed, total: REVIEW_SECTIONS.length })}</span>
            </div>
            <FinalDecisionPanel applicationId={a.id} suggestProfessional={t.educations.some((e) => e.documentId)} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

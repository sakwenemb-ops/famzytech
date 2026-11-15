import "server-only";
import type { ApplicationSection, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Wizard order. Each step has a URL slug: /teacher/application/<slug>. */
export const STEPS: ApplicationSection[] = [
  "ABOUT",
  "PHOTO",
  "CERTIFICATION",
  "EDUCATION",
  "DESCRIPTION",
  "VIDEO",
  "AVAILABILITY",
  "PRICING",
  "IDENTITY",
  "AGREEMENT",
];
export const stepSlug = (s: ApplicationSection) => s.toLowerCase();
export const stepFromSlug = (slug: string) => STEPS.find((s) => stepSlug(s) === slug) ?? null;

/** Sections an admin reviews (the agreement is not reviewed). */
export const REVIEW_SECTIONS = STEPS.filter((s) => s !== "AGREEMENT");

export const DESCRIPTION_LIMITS = { headlineMin: 10, headlineMax: 120, bioMin: 100, bioMax: 2000, experienceMax: 1000 };
export const PRICE_LIMITS = { min: 1000, max: 100_000 };

const include = {
  application: { include: { reviews: true } },
  certificates: { include: { document: { select: { id: true, mimeType: true } } } },
  educations: { include: { document: { select: { id: true, mimeType: true } } } },
  availability: { orderBy: [{ weekday: "asc" }, { startMin: "asc" }] },
  badges: true,
  user: true,
} satisfies Prisma.TeacherProfileInclude;

export type TeacherWithApplication = Prisma.TeacherProfileGetPayload<{ include: typeof include }>;

export async function loadTeacherApplication(where: Prisma.TeacherProfileWhereUniqueInput) {
  const teacher = await db.teacherProfile.findUnique({ where, include });
  if (!teacher) return null;
  // Every teacher has an application; create it if an old account lacks one
  if (!teacher.application) {
    await db.teacherApplication.create({ data: { teacherId: teacher.id } });
    return db.teacherProfile.findUnique({ where, include });
  }
  return teacher;
}

const len = (s?: string | null) => (s ?? "").trim().length;

export function isStepComplete(step: ApplicationSection, t: TeacherWithApplication): boolean {
  const a = t.application!;
  const spoken = Array.isArray(t.spokenLanguages) ? t.spokenLanguages : [];
  switch (step) {
    case "ABOUT":
      return t.subjects.length > 0 && spoken.length > 0 && Boolean(t.countryOfBirth);
    case "PHOTO":
      return Boolean(t.photoUrl);
    case "CERTIFICATION":
      return t.certificates.length > 0 || a.noCertificate;
    case "EDUCATION":
      return t.educations.length > 0 || a.noEducation;
    case "DESCRIPTION": {
      const L = DESCRIPTION_LIMITS;
      return (
        len(t.headlineEn) >= L.headlineMin &&
        len(t.headlineFr) >= L.headlineMin &&
        len(t.bioEn) >= L.bioMin &&
        len(t.bioFr) >= L.bioMin &&
        t.specialties.length > 0
      );
    }
    case "VIDEO":
      return Boolean(t.videoUrl);
    case "AVAILABILITY":
      return t.availability.length > 0;
    case "PRICING":
      return t.hourlyRateXaf != null && t.trialRateXaf != null;
    case "IDENTITY":
      return Boolean(a.idDocumentType && a.idFrontDocId && a.idSelfieDocId && (a.idBackDocId || a.idDocumentType === "PASSPORT"));
    case "AGREEMENT":
      return Boolean(a.termsAcceptedAt);
  }
}

export function completedSteps(t: TeacherWithApplication) {
  return STEPS.filter((s) => isStepComplete(s, t));
}

/** Reviews of the current round, by section. */
export function currentReviews(t: TeacherWithApplication) {
  const a = t.application!;
  return new Map(a.reviews.filter((r) => r.round === a.round).map((r) => [r.section, r]));
}

/**
 * Reviews the teacher should see while fixing their application: the round that asked
 * for changes (or rejected it), which is the round before the current one once they edit.
 */
export function feedbackReviews(t: TeacherWithApplication) {
  const a = t.application!;
  const round = a.status === "CHANGES_REQUESTED" || a.status === "REJECTED" ? a.round : a.round - 1;
  return new Map(a.reviews.filter((r) => r.round === round && r.comment).map((r) => [r.section, r]));
}

/** May the teacher change this step right now? */
export function canEdit(step: ApplicationSection, t: TeacherWithApplication) {
  const a = t.application!;
  if (a.status === "DRAFT") return true;
  if (a.status === "CHANGES_REQUESTED") {
    if (step === "AGREEMENT") return true;
    return currentReviews(t).get(step)?.decision === "NEEDS_CHANGES";
  }
  return false;
}

/** Recompute and store which steps are complete. Call after every save. */
export async function refreshProgress(teacherId: string) {
  const t = await loadTeacherApplication({ id: teacherId });
  if (!t) return;
  await db.teacherApplication.update({ where: { teacherId }, data: { completedSteps: completedSteps(t) } });
}

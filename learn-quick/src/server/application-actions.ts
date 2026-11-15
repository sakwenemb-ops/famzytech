"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import type { ApplicationSection, DocumentKind } from "@prisma/client";
import { db } from "@/lib/db";
import { fieldErrors } from "@/lib/validation";
import { LANGUAGES, LEVELS, SPECIALTIES } from "@/lib/constants";
import { COUNTRIES } from "@/lib/countries";
import { redirect } from "@/i18n/navigation";
import { assertRole } from "./session";
import { deleteDocument, fileUrl, ownedDocument } from "./files";
import {
  DESCRIPTION_LIMITS as L,
  PRICE_LIMITS,
  STEPS,
  canEdit,
  completedSteps,
  loadTeacherApplication,
  refreshProgress,
  stepSlug,
} from "./application";
import type { FormState } from "./auth-actions";

/** Load the signed-in teacher and check they may edit this step. */
async function editable(step: ApplicationSection) {
  const user = await assertRole("TEACHER");
  const t = await loadTeacherApplication({ userId: user.id });
  if (!t || !canEdit(step, t)) throw new Error("FORBIDDEN");
  return { user, t };
}

async function done(teacherId: string, step: ApplicationSection, fd?: FormData): Promise<FormState> {
  await refreshProgress(teacherId);
  revalidatePath("/[locale]/teacher", "layout");
  // "Save and continue" moves to the next step
  if (fd?.get("continue") === "1") {
    const next = STEPS[STEPS.indexOf(step) + 1];
    if (next) redirect({ href: `/teacher/application/${stepSlug(next)}`, locale: await getLocale() });
  }
  return { ok: true, message: "saved" };
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
const optInt = (fd: FormData, k: string) => (str(fd, k) === "" ? undefined : Number(str(fd, k)));

// ─── Step 1: about ───

const spokenSchema = z
  .array(z.object({ language: z.string().trim().min(2).max(40), level: z.enum([...LEVELS, "NATIVE"]) }))
  .min(1, "spoken_required")
  .max(8)
  .refine((rows) => new Set(rows.map((r) => r.language.toLowerCase())).size === rows.length, "spoken_duplicate");

export async function saveAboutAction(_: FormState, fd: FormData): Promise<FormState> {
  const { t } = await editable("ABOUT");
  let spokenRaw: unknown = [];
  try {
    spokenRaw = JSON.parse(str(fd, "spoken") || "[]");
  } catch {}
  const parsed = z
    .object({
      subjects: z.array(z.enum(LANGUAGES)).min(1, "subject_required"),
      spoken: spokenSchema,
      countryOfBirth: z.string().refine((c) => COUNTRIES.some((x) => x.code === c) || c === "OTHER", "invalid"),
    })
    .safeParse({ subjects: fd.getAll("subjects"), spoken: spokenRaw, countryOfBirth: str(fd, "countryOfBirth") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const d = parsed.data;
  // A teacher must speak each language they teach at C1 or above
  for (const subject of d.subjects) {
    const row = d.spoken.find((r) => r.language === subject);
    if (!row || !["C1", "C2", "NATIVE"].includes(row.level)) return { errors: { spoken: "subject_level_low" } };
  }
  await db.teacherProfile.update({
    where: { id: t.id },
    data: {
      subjects: d.subjects,
      spokenLanguages: d.spoken,
      nativeLanguages: d.spoken.filter((r) => r.level === "NATIVE" && (LANGUAGES as readonly string[]).includes(r.language)).map((r) => r.language as "ENGLISH" | "FRENCH"),
      countryOfBirth: d.countryOfBirth,
    },
  });
  return done(t.id, "ABOUT", fd);
}

// ─── Steps 2 and 6: photo and video ───

async function setMedia(step: "PHOTO" | "VIDEO", kind: DocumentKind, docId: string) {
  const { user, t } = await editable(step);
  const doc = await ownedDocument(user.id, docId, [kind]);
  if (!doc) throw new Error("NOT_FOUND");
  const field = step === "PHOTO" ? "photoUrl" : "videoUrl";
  const previous = t[field]?.split("/").pop();
  await db.teacherProfile.update({ where: { id: t.id }, data: { [field]: fileUrl(doc.id) } });
  if (step === "PHOTO") await db.user.update({ where: { id: user.id }, data: { image: fileUrl(doc.id) } });
  if (previous && previous !== doc.id) await deleteDocument(previous);
  return done(t.id, step);
}

export async function setPhotoAction(docId: string) {
  return setMedia("PHOTO", "PROFILE_PHOTO", docId);
}
export async function setVideoAction(docId: string) {
  return setMedia("VIDEO", "INTRO_VIDEO", docId);
}

// ─── Steps 3 and 4: certificates and education ───

const year = z.number().int().min(1950).max(new Date().getFullYear() + 1).optional();

export async function addCertificateAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, t } = await editable("CERTIFICATION");
  const parsed = z
    .object({
      name: z.string().min(2, "required").max(120),
      issuer: z.string().min(2, "required").max(120),
      yearFrom: year,
      yearTo: year,
      documentId: z.string().min(1, "file_required"),
    })
    .safeParse({ name: str(fd, "name"), issuer: str(fd, "issuer"), yearFrom: optInt(fd, "yearFrom"), yearTo: optInt(fd, "yearTo"), documentId: str(fd, "documentId") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (!(await ownedDocument(user.id, d.documentId, ["CERTIFICATE"]))) return { errors: { documentId: "file_required" } };

  await db.$transaction([
    db.certificate.create({ data: { teacherId: t.id, name: d.name, issuer: d.issuer, yearFrom: d.yearFrom, yearTo: d.yearTo, documentId: d.documentId } }),
    db.teacherApplication.update({ where: { teacherId: t.id }, data: { noCertificate: false } }),
  ]);
  return done(t.id, "CERTIFICATION");
}

export async function addEducationAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, t } = await editable("EDUCATION");
  const parsed = z
    .object({
      university: z.string().min(2, "required").max(120),
      degree: z.string().min(2, "required").max(80),
      field: z.string().min(2, "required").max(120),
      yearFrom: year,
      yearTo: year,
      documentId: z.string().optional(),
    })
    .safeParse({
      university: str(fd, "university"),
      degree: str(fd, "degree"),
      field: str(fd, "field"),
      yearFrom: optInt(fd, "yearFrom"),
      yearTo: optInt(fd, "yearTo"),
      documentId: str(fd, "documentId") || undefined,
    });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  if (d.documentId && !(await ownedDocument(user.id, d.documentId, ["DEGREE"]))) return { errors: { documentId: "file_required" } };

  await db.$transaction([
    db.education.create({ data: { teacherId: t.id, ...d } }),
    db.teacherApplication.update({ where: { teacherId: t.id }, data: { noEducation: false } }),
  ]);
  return done(t.id, "EDUCATION");
}

export async function removeQualificationAction(type: "certificate" | "education", id: string) {
  const { t } = await editable(type === "certificate" ? "CERTIFICATION" : "EDUCATION");
  const row =
    type === "certificate"
      ? await db.certificate.findFirst({ where: { id, teacherId: t.id } })
      : await db.education.findFirst({ where: { id, teacherId: t.id } });
  if (!row) return;
  if (type === "certificate") await db.certificate.delete({ where: { id } });
  else await db.education.delete({ where: { id } });
  if (row.documentId) await deleteDocument(row.documentId);
  await done(t.id, type === "certificate" ? "CERTIFICATION" : "EDUCATION");
}

export async function setNoQualificationAction(type: "certificate" | "education", value: boolean) {
  const { t } = await editable(type === "certificate" ? "CERTIFICATION" : "EDUCATION");
  await db.teacherApplication.update({
    where: { teacherId: t.id },
    data: type === "certificate" ? { noCertificate: value } : { noEducation: value },
  });
  await done(t.id, type === "certificate" ? "CERTIFICATION" : "EDUCATION");
}

// ─── Step 5: description ───

export async function saveDescriptionAction(_: FormState, fd: FormData): Promise<FormState> {
  const { t } = await editable("DESCRIPTION");
  const headline = z.string().min(L.headlineMin, "headline_short").max(L.headlineMax);
  const bio = z.string().min(L.bioMin, "bio_short").max(L.bioMax);
  const exp = z.string().max(L.experienceMax).optional();
  const parsed = z
    .object({
      headlineEn: headline,
      headlineFr: headline,
      bioEn: bio,
      bioFr: bio,
      experienceEn: exp,
      experienceFr: exp,
      specialties: z.array(z.enum(SPECIALTIES)).min(1, "specialty_required"),
    })
    .safeParse({
      headlineEn: str(fd, "headlineEn"),
      headlineFr: str(fd, "headlineFr"),
      bioEn: str(fd, "bioEn"),
      bioFr: str(fd, "bioFr"),
      experienceEn: str(fd, "experienceEn") || undefined,
      experienceFr: str(fd, "experienceFr") || undefined,
      specialties: fd.getAll("specialties"),
    });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Contact details are not allowed in public texts (students must book through the site)
  const contact = /(\+?\d[\d\s.-]{7,}\d)|([^\s@]+@[^\s@]+\.[a-z]{2,})|(https?:\/\/|www\.)|whats\s?app/i;
  for (const k of ["headlineEn", "headlineFr", "bioEn", "bioFr", "experienceEn", "experienceFr"] as const) {
    if (parsed.data[k] && contact.test(parsed.data[k]!)) return { errors: { [k]: "no_contact_details" } };
  }
  await db.teacherProfile.update({
    where: { id: t.id },
    data: { ...parsed.data, experienceEn: parsed.data.experienceEn ?? null, experienceFr: parsed.data.experienceFr ?? null },
  });
  return done(t.id, "DESCRIPTION", fd);
}

// ─── Step 7: availability ───

const slotSchema = z
  .array(
    z
      .object({ weekday: z.number().int().min(0).max(6), startMin: z.number().int().min(0).max(1440), endMin: z.number().int().min(0).max(1440) })
      .refine((s) => s.startMin % 30 === 0 && s.endMin % 30 === 0 && s.endMin - s.startMin >= 60, "slot_invalid"),
  )
  .min(1, "slot_required")
  .max(70);

export async function saveAvailabilityAction(_: FormState, fd: FormData): Promise<FormState> {
  const { t } = await editable("AVAILABILITY");
  let raw: unknown = [];
  try {
    raw = JSON.parse(str(fd, "slots") || "[]");
  } catch {}
  const parsed = slotSchema.safeParse(raw);
  if (!parsed.success) return { errors: { slots: parsed.error.issues[0]?.message ?? "slot_invalid" } };

  const slots = [...parsed.data].sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin);
  for (let i = 1; i < slots.length; i++) {
    if (slots[i].weekday === slots[i - 1].weekday && slots[i].startMin < slots[i - 1].endMin) return { errors: { slots: "slot_overlap" } };
  }
  await db.$transaction([
    db.availabilityRule.deleteMany({ where: { teacherId: t.id } }),
    db.availabilityRule.createMany({ data: slots.map((s) => ({ ...s, teacherId: t.id })) }),
  ]);
  return done(t.id, "AVAILABILITY", fd);
}

// ─── Step 8: pricing ───

export async function savePricingAction(_: FormState, fd: FormData): Promise<FormState> {
  const { t } = await editable("PRICING");
  const price = z.number({ invalid_type_error: "price_invalid" }).int("price_invalid").min(PRICE_LIMITS.min, "price_range").max(PRICE_LIMITS.max, "price_range");
  const pct = z.number().int().min(0).max(30);
  const parsed = z
    .object({ hourlyRateXaf: price, trialRateXaf: price, package5Discount: pct, package10Discount: pct, package20Discount: pct })
    .refine((v) => v.trialRateXaf <= v.hourlyRateXaf, { message: "trial_too_high", path: ["trialRateXaf"] })
    .safeParse({
      hourlyRateXaf: optInt(fd, "hourlyRateXaf"),
      trialRateXaf: optInt(fd, "trialRateXaf"),
      package5Discount: optInt(fd, "package5Discount") ?? 0,
      package10Discount: optInt(fd, "package10Discount") ?? 0,
      package20Discount: optInt(fd, "package20Discount") ?? 0,
    });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  await db.teacherProfile.update({ where: { id: t.id }, data: parsed.data });
  return done(t.id, "PRICING", fd);
}

// ─── Step 9: identity ───

export async function saveIdentityAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, t } = await editable("IDENTITY");
  const type = str(fd, "idDocumentType");
  if (!["CNI", "PASSPORT", "RESIDENCE_PERMIT"].includes(type)) return { errors: { idDocumentType: "required" } };

  const front = await ownedDocument(user.id, str(fd, "idFrontDocId"), ["ID_FRONT"]);
  const back = type === "PASSPORT" ? null : await ownedDocument(user.id, str(fd, "idBackDocId"), ["ID_BACK"]);
  const selfie = await ownedDocument(user.id, str(fd, "idSelfieDocId"), ["ID_SELFIE"]);
  const errors: Record<string, string> = {};
  if (!front) errors.idFrontDocId = "file_required";
  if (type !== "PASSPORT" && !back) errors.idBackDocId = "file_required";
  if (!selfie) errors.idSelfieDocId = "file_required";
  if (Object.keys(errors).length) return { errors };

  const a = t.application!;
  await db.teacherApplication.update({
    where: { teacherId: t.id },
    data: { idDocumentType: type, idFrontDocId: front!.id, idBackDocId: back?.id ?? null, idSelfieDocId: selfie!.id },
  });
  // Remove replaced identity files straight away
  for (const old of [a.idFrontDocId, a.idBackDocId, a.idSelfieDocId]) {
    if (old && ![front!.id, back?.id, selfie!.id].includes(old)) await deleteDocument(old);
  }
  return done(t.id, "IDENTITY", fd);
}

// ─── Step 10: agreement and submit ───

export async function submitApplicationAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, t } = await editable("AGREEMENT");
  for (const k of ["acceptTerms", "acceptConduct", "acceptPayouts"]) {
    if (fd.get(k) !== "on") return { errors: { [k]: "terms_required" } };
  }
  const complete = completedSteps(t);
  if (STEPS.some((s) => s !== "AGREEMENT" && !complete.includes(s))) return { message: "steps_incomplete" };

  const a = t.application!;
  const resubmission = a.status === "CHANGES_REQUESTED";
  const round = resubmission ? a.round + 1 : a.round;

  await db.$transaction(async (tx) => {
    await tx.teacherApplication.update({
      where: { id: a.id },
      data: { status: "SUBMITTED", submittedAt: new Date(), termsAcceptedAt: new Date(), round },
    });
    if (resubmission) {
      // Sections approved last round stay approved; the reviewer only re-checks the fixed ones
      const approved = a.reviews.filter((r) => r.round === a.round && r.decision === "APPROVED");
      if (approved.length) {
        await tx.applicationReview.createMany({
          data: approved.map((r) => ({ applicationId: a.id, reviewerId: r.reviewerId, round, section: r.section, decision: "APPROVED" as const, comment: r.comment })),
        });
      }
    }
    await tx.auditLog.create({
      data: { actorId: user.id, action: resubmission ? "APPLICATION_RESUBMITTED" : "APPLICATION_SUBMITTED", targetType: "TeacherApplication", targetId: a.id, meta: { round } },
    });
  });
  await refreshProgress(t.id);
  revalidatePath("/[locale]/teacher", "layout");
  redirect({ href: "/teacher", locale: await getLocale() });
}

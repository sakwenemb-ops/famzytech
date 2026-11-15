"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ApplicationSection } from "@prisma/client";
import { db } from "@/lib/db";
import { assertRole } from "./session";
import { REVIEW_SECTIONS, currentReviews, loadTeacherApplication } from "./application";
import { notify } from "./notify";

const ID_RETENTION_DAYS = 90;

async function reviewable(applicationId: string) {
  const admin = await assertRole("ADMIN");
  const app = await db.teacherApplication.findUnique({ where: { id: applicationId } });
  if (!app) throw new Error("NOT_FOUND");
  const t = await loadTeacherApplication({ id: app.teacherId });
  return { admin, t: t!, app };
}

const refresh = (id: string) => {
  revalidatePath(`/[locale]/admin/applications/${id}`, "page");
  revalidatePath("/[locale]/admin", "layout");
};

export async function startReviewAction(applicationId: string) {
  const { admin, app } = await reviewable(applicationId);
  if (app.status !== "SUBMITTED") return;
  await db.$transaction([
    db.teacherApplication.update({ where: { id: app.id }, data: { status: "UNDER_REVIEW" } }),
    db.auditLog.create({ data: { actorId: admin.id, action: "APPLICATION_REVIEW_STARTED", targetType: "TeacherApplication", targetId: app.id } }),
  ]);
  refresh(app.id);
}

const decisionSchema = z.object({
  section: z.enum(REVIEW_SECTIONS as [ApplicationSection, ...ApplicationSection[]]),
  decision: z.enum(["APPROVED", "NEEDS_CHANGES", "REJECTED"]),
  comment: z.string().trim().max(1000).optional(),
});

/** Save the decision for one section. Changes and rejections need a comment the teacher can act on. */
export async function decideSectionAction(applicationId: string, input: z.input<typeof decisionSchema>) {
  const { admin, app } = await reviewable(applicationId);
  if (app.status !== "UNDER_REVIEW") return { error: "not_under_review" };
  const d = decisionSchema.parse(input);
  if (d.decision !== "APPROVED" && !d.comment) return { error: "comment_required" };

  await db.applicationReview.upsert({
    where: { applicationId_round_section: { applicationId: app.id, round: app.round, section: d.section } },
    create: { applicationId: app.id, round: app.round, section: d.section, decision: d.decision, comment: d.comment, reviewerId: admin.id },
    update: { decision: d.decision, comment: d.comment ?? null, reviewerId: admin.id },
  });
  refresh(app.id);
  return { ok: true };
}

export type FinalDecision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

export async function finishReviewAction(applicationId: string, decision: FinalDecision, opts: { professional?: boolean } = {}) {
  const { admin, t, app } = await reviewable(applicationId);
  if (app.status !== "UNDER_REVIEW") return { error: "not_under_review" };
  const reviews = currentReviews(t);
  const decisions = REVIEW_SECTIONS.map((s) => reviews.get(s)?.decision ?? "PENDING");
  const now = new Date();
  const purgeAt = new Date(now.getTime() + ID_RETENTION_DAYS * 86_400_000);
  const idDocs = [app.idFrontDocId, app.idBackDocId, app.idSelfieDocId].filter((x): x is string => Boolean(x));

  if (decision === "APPROVE") {
    if (decisions.some((d) => d !== "APPROVED")) return { error: "all_sections_must_be_approved" };
    const certified = t.certificates.length > 0;
    const badges = ["VERIFIED_ID" as const, ...(certified ? (["CERTIFIED"] as const) : []), ...(opts.professional ? (["PROFESSIONAL"] as const) : [])];
    await db.$transaction([
      db.teacherApplication.update({ where: { id: app.id }, data: { status: "APPROVED", decidedAt: now, identityPurgeAt: purgeAt } }),
      db.teacherProfile.update({ where: { id: t.id }, data: { isPublished: true } }),
      db.certificate.updateMany({ where: { teacherId: t.id }, data: { verified: true } }),
      // A degree counts as checked only when a document was provided
      db.education.updateMany({ where: { teacherId: t.id, documentId: { not: null } }, data: { verified: true } }),
      db.teacherBadge.deleteMany({ where: { teacherId: t.id, type: { in: ["VERIFIED_ID", "CERTIFIED", "PROFESSIONAL"] } } }),
      db.teacherBadge.createMany({ data: badges.map((type) => ({ teacherId: t.id, type })) }),
      db.document.updateMany({ where: { id: { in: idDocs } }, data: { purgeAt } }),
      db.auditLog.create({ data: { actorId: admin.id, action: "APPLICATION_APPROVED", targetType: "TeacherApplication", targetId: app.id, meta: { round: app.round, badges } } }),
    ]);
    await notify(t.userId, {
      type: "APPLICATION_APPROVED",
      title: { en: "Your application is approved", fr: "Votre candidature est approuvée" },
      body: {
        en: "Congratulations! Your teacher profile is now live and students can find you.",
        fr: "Félicitations ! Votre profil d'enseignant est en ligne et les élèves peuvent vous trouver.",
      },
      link: `/teachers/${t.id}`,
    });
  } else if (decision === "REQUEST_CHANGES") {
    if (!decisions.includes("NEEDS_CHANGES")) return { error: "no_changes_marked" };
    if (decisions.includes("REJECTED")) return { error: "use_reject" };
    await db.$transaction([
      db.teacherApplication.update({ where: { id: app.id }, data: { status: "CHANGES_REQUESTED", termsAcceptedAt: null } }),
      db.auditLog.create({ data: { actorId: admin.id, action: "APPLICATION_CHANGES_REQUESTED", targetType: "TeacherApplication", targetId: app.id, meta: { round: app.round } } }),
    ]);
    await notify(t.userId, {
      type: "APPLICATION_CHANGES_REQUESTED",
      title: { en: "Changes requested on your application", fr: "Modifications demandées sur votre candidature" },
      body: {
        en: "Our reviewer asked you to update some parts of your application. Open it to see their comments.",
        fr: "Notre examinateur vous demande de modifier certaines parties de votre candidature. Ouvrez-la pour lire ses commentaires.",
      },
      link: "/teacher/application",
    });
  } else {
    if (!decisions.includes("REJECTED")) return { error: "no_rejection_marked" };
    await db.$transaction([
      db.teacherApplication.update({ where: { id: app.id }, data: { status: "REJECTED", decidedAt: now, identityPurgeAt: purgeAt } }),
      db.document.updateMany({ where: { id: { in: idDocs } }, data: { purgeAt } }),
      db.auditLog.create({ data: { actorId: admin.id, action: "APPLICATION_REJECTED", targetType: "TeacherApplication", targetId: app.id, meta: { round: app.round } } }),
    ]);
    await notify(t.userId, {
      type: "APPLICATION_REJECTED",
      title: { en: "Your application was not approved", fr: "Votre candidature n'a pas été approuvée" },
      body: { en: "Open your application to read the reviewer's comments.", fr: "Ouvrez votre candidature pour lire les commentaires de l'examinateur." },
      link: "/teacher/application",
    });
  }
  refresh(app.id);
  return { ok: true };
}

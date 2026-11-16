"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { SETTING_RULES, type EditableSetting } from "@/lib/setting-rules";
import { assertRole } from "./session";
import { DEFAULTS } from "./settings";
import { cancelBooking } from "./booking";
import { notify } from "./notify";
import { refreshRating } from "./ratings";

type State = { ok?: true; error?: string; errors?: Record<string, string>; cancelled?: number } | undefined;

/**
 * Suspend: the person is signed out at once (status is read on every request), a teacher is
 * hidden from the catalogue, and their upcoming lessons are cancelled with a full refund.
 */
export async function setUserStatusAction(userId: string, _: State, fd: FormData): Promise<State> {
  const admin = await assertRole("ADMIN");
  const parsed = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]), reason: z.string().trim().min(5).max(500) }).safeParse({ status: fd.get("status"), reason: fd.get("reason") });
  if (!parsed.success) return { error: "reason_required" };
  const { status, reason } = parsed.data;
  const user = await db.user.findUnique({ where: { id: userId }, include: { teacherProfile: { include: { application: true } }, studentProfile: true } });
  if (!user || user.status === "DELETED") return { error: "not_found" };
  if (user.id === admin.id || user.role === "ADMIN") return { error: "not_allowed" };

  await db.$transaction(async (t) => {
    await t.user.update({ where: { id: userId }, data: { status } });
    if (user.teacherProfile) {
      const approved = user.teacherProfile.application?.status === "APPROVED";
      await t.teacherProfile.update({ where: { id: user.teacherProfile.id }, data: { isPublished: status === "ACTIVE" && approved } });
    }
    await t.auditLog.create({ data: { actorId: admin.id, action: status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED", targetType: "User", targetId: userId, meta: { reason } } });
  });

  let cancelled = 0;
  if (status === "SUSPENDED") {
    const upcoming = await db.booking.findMany({
      where: { status: "CONFIRMED", startsAt: { gt: new Date() }, OR: [{ teacher: { userId } }, { student: { userId } }] },
      include: { teacher: { include: { user: true } } },
    });
    // Cancelled on the teacher's side, so the student always gets a full refund
    for (const b of upcoming) if ("ok" in (await cancelBooking({ ...b.teacher.user, status: "ACTIVE" }, b.id))) cancelled++;
  } else {
    await notify(userId, { type: "ACCOUNT_REACTIVATED", title: { en: "Account reactivated", fr: "Compte réactivé" }, body: { en: "You can use Learn Quick again.", fr: "Vous pouvez à nouveau utiliser Learn Quick." }, link: "/" });
  }
  revalidatePath("/[locale]/admin/users", "layout");
  return { ok: true, cancelled };
}

export async function saveSettingsAction(_: State, fd: FormData): Promise<State> {
  const admin = await assertRole("ADMIN");
  const errors: Record<string, string> = {};
  const values: Partial<Record<EditableSetting, number | boolean>> = {};
  for (const [key, rule] of Object.entries(SETTING_RULES) as [EditableSetting, (typeof SETTING_RULES)[EditableSetting]][]) {
    const r = rule.safeParse(fd.get(key) ?? (key === "payoutRequiresApproval" ? "off" : undefined));
    if (r.success) values[key] = r.data;
    else errors[key] = "out_of_range";
  }
  if (Object.keys(errors).length) return { errors };

  const before = Object.fromEntries((await db.platformSetting.findMany()).map((s) => [s.key, s.value]));
  const changed = (Object.keys(values) as EditableSetting[]).filter((k) => (before[k] ?? DEFAULTS[k]) !== values[k]);
  if (changed.length) {
    await db.$transaction([
      ...changed.map((k) => db.platformSetting.upsert({ where: { key: k }, create: { key: k, value: values[k]! }, update: { value: values[k]! } })),
      db.auditLog.create({
        data: { actorId: admin.id, action: "SETTINGS_CHANGED", targetType: "PlatformSetting", targetId: changed.join(","), meta: Object.fromEntries(changed.map((k) => [k, { from: before[k] ?? DEFAULTS[k], to: values[k] }])) },
      }),
    ]);
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

/** Admins close a report after looking at the conversation. */
export async function dismissReportAction(conversationId: string) {
  const admin = await assertRole("ADMIN");
  await db.$transaction([
    db.conversation.update({ where: { id: conversationId }, data: { reportedAt: null, reportedById: null, reportReason: null } }),
    db.auditLog.create({ data: { actorId: admin.id, action: "REPORT_CLOSED", targetType: "Conversation", targetId: conversationId } }),
  ]);
  revalidatePath("/[locale]/admin/reports", "layout");
}

/** Hide an unfair or abusive review (it no longer counts in the rating). */
export async function setReviewHiddenAction(reviewId: string, hidden: boolean) {
  const admin = await assertRole("ADMIN");
  const r = await db.review.update({ where: { id: reviewId }, data: { hidden } });
  await refreshRating(r.teacherId);
  await db.auditLog.create({ data: { actorId: admin.id, action: hidden ? "REVIEW_HIDDEN" : "REVIEW_SHOWN", targetType: "Review", targetId: reviewId } });
  revalidatePath("/[locale]", "layout");
}

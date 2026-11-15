import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireRole } from "@/server/session";
import { STEPS, canEdit, completedSteps, currentReviews, loadTeacherApplication, stepSlug } from "@/server/application";

/** Open the most useful step: the first one to fix, else the first unfinished one, else the last. */
export default async function ApplicationIndex() {
  const user = await requireRole("TEACHER");
  const t = (await loadTeacherApplication({ userId: user.id }))!;
  const done = completedSteps(t);
  const reviews = currentReviews(t);
  const target =
    STEPS.find((s) => t.application!.status === "CHANGES_REQUESTED" && reviews.get(s)?.decision === "NEEDS_CHANGES") ??
    STEPS.find((s) => !done.includes(s) && canEdit(s, t)) ??
    "AGREEMENT";
  redirect({ href: `/teacher/application/${stepSlug(target)}`, locale: await getLocale() });
}

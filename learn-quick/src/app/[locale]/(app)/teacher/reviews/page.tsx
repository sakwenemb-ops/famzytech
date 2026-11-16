import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireRole } from "@/server/session";
import { DashboardShell, EmptyState, PageTitle, Stat } from "@/components/dashboard/shell";
import { teacherNav } from "@/components/dashboard/nav";
import { Stars } from "@/components/ui/stars";

export default async function TeacherReviews({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");
  const t = await getTranslations("teacherReviews");
  const td = await getTranslations("dashboard");
  const format = await getFormatter();
  const profile = await db.teacherProfile.findUnique({ where: { userId: user.id } });
  const reviews = profile
    ? await db.review.findMany({ where: { teacherId: profile.id, hidden: false }, orderBy: { createdAt: "desc" }, take: 100, include: { student: { include: { user: { select: { name: true } } } } } })
    : [];
  return (
    <DashboardShell nav={teacherNav(td)} active="/teacher/reviews">
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-4 grid grid-cols-2 gap-4">
        <Stat label={t("average")} value={profile?.ratingCount ? profile.ratingAvg.toFixed(1) : "—"} />
        <Stat label={t("count")} value={profile?.ratingCount ?? 0} />
      </div>
      {reviews.length === 0 ? (
        <EmptyState text={t("none")} />
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{r.student.user.name.split(" ")[0]}</span>
                <Stars value={r.rating} label={t("stars", { n: r.rating })} />
              </div>
              {r.comment && <p className="mt-2 whitespace-pre-wrap text-sm">{r.comment}</p>}
              <p className="mt-1 text-xs text-muted">{format.dateTime(r.createdAt, { dateStyle: "medium" })}</p>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}

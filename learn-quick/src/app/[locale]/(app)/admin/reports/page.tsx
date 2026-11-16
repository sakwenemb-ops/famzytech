import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireRole } from "@/server/session";
import { DashboardShell, EmptyState, PageTitle } from "@/components/dashboard/shell";
import { adminNav } from "@/components/dashboard/nav";
import { Link } from "@/i18n/navigation";

export default async function AdminReports({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const t = await getTranslations("reports");
  const td = await getTranslations("dashboard");
  const format = await getFormatter();
  const reported = await db.conversation.findMany({
    where: { reportedAt: { not: null } },
    orderBy: { reportedAt: "asc" },
    include: { student: { select: { name: true } }, teacher: { select: { name: true } } },
  });
  return (
    <DashboardShell nav={adminNav(td)} active="/admin/reports">
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      {reported.length === 0 ? (
        <EmptyState text={t("none")} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
          {reported.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/reports/${c.id}`} className="block px-4 py-3 hover:bg-surface-2">
                <span className="font-medium">{c.student.name} ⇄ {c.teacher.name}</span>
                <span className="block truncate text-sm text-muted">{c.reportReason}</span>
                <span className="block text-xs text-muted">{format.relativeTime(c.reportedAt!)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}

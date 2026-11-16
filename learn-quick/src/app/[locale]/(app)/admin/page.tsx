import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireRole } from "@/server/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell, PageTitle, Stat } from "@/components/dashboard/shell";
import { adminNav } from "@/components/dashboard/nav";
import { Link } from "@/i18n/navigation";

export default async function AdminDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const t = await getTranslations("dashboard");
  const tr = await getTranslations("roles");
  const format = await getFormatter();

  const [openDisputes, reports, payoutsToApprove] = await Promise.all([
    db.dispute.count({ where: { status: "OPEN" } }),
    db.conversation.count({ where: { reportedAt: { not: null } } }),
    db.payout.count({ where: { status: "REQUESTED" } }),
  ]);
  const [total, students, teachers, pendingApps, recent] = await Promise.all([
    db.user.count({ where: { status: { not: "DELETED" } } }),
    db.user.count({ where: { role: "STUDENT", status: { not: "DELETED" } } }),
    db.user.count({ where: { role: "TEACHER", status: { not: "DELETED" } } }),
    db.teacherApplication.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return (
    <DashboardShell nav={adminNav(t)} active="/admin">
      <PageTitle title={t("overview")} subtitle={t("admin.subtitle")} />
      {(() => {
        const todo = [
          { n: pendingApps, href: "/admin/applications", label: t("admin.todoApplications", { count: pendingApps }) },
          { n: openDisputes, href: "/admin/disputes", label: t("admin.todoDisputes", { count: openDisputes }) },
          { n: reports, href: "/admin/reports", label: t("admin.todoReports", { count: reports }) },
          { n: payoutsToApprove, href: "/admin/payments", label: t("admin.todoPayouts", { count: payoutsToApprove }) },
        ].filter((x) => x.n > 0);
        return todo.length > 0 ? (
          <ul className="mb-6 flex flex-wrap gap-2" aria-label={t("admin.todo")}>
            {todo.map((x) => (
              <li key={x.href}>
                <Link href={x.href} className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning-soft px-3 py-1.5 text-sm font-medium hover:underline">
                  {x.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : null;
      })()}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t("admin.totalUsers")} value={total} />
        <Stat label={t("admin.students")} value={students} />
        <Stat label={t("admin.teachers")} value={teachers} />
        <Stat label={t("admin.pendingApplications")} value={pendingApps} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("admin.recentUsers")}</CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-4 font-medium">{t("admin.name")}</th>
                <th className="py-2 pr-4 font-medium">{t("admin.role")}</th>
                <th className="py-2 pr-4 font-medium">{t("admin.verified")}</th>
                <th className="py-2 font-medium">{t("admin.joined")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent.map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 pr-4">
                    <Link href={`/admin/users/${u.id}`} className="font-medium text-primary hover:underline">{u.name || "—"}</Link>
                    <div className="text-xs text-muted">{u.email ?? u.phone}</div>
                  </td>
                  <td className="py-2.5 pr-4"><Badge>{tr(u.role)}</Badge></td>
                  <td className="py-2.5 pr-4">
                    {u.emailVerified || u.phoneVerified ? <Badge tone="success">{t("admin.yes")}</Badge> : <Badge tone="warning">{t("admin.no")}</Badge>}
                  </td>
                  <td className="py-2.5 text-muted">{format.dateTime(u.createdAt, { dateStyle: "medium" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </DashboardShell>
  );
}

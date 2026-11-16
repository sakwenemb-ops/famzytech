import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireRole } from "@/server/session";
import { dismissReportAction } from "@/server/admin-actions";
import { DashboardShell, PageTitle } from "@/components/dashboard/shell";
import { adminNav } from "@/components/dashboard/nav";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Admins read a reported conversation (read-only; they never write in it). */
export default async function AdminReport({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const admin = await requireRole("ADMIN");
  const c = await db.conversation.findUnique({ where: { id }, include: { student: true, teacher: true, messages: { orderBy: { createdAt: "asc" }, take: 500 } } });
  if (!c) notFound();
  const t = await getTranslations("reports");
  const td = await getTranslations("dashboard");
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: admin.timeZone });
  const reporter = c.reportedById === c.studentId ? c.student : c.teacher;

  return (
    <DashboardShell nav={adminNav(td)} active="/admin/reports">
      <Link href="/admin/reports" className="mb-3 inline-block text-sm text-primary hover:underline">← {t("title")}</Link>
      <PageTitle title={`${c.student.name} ⇄ ${c.teacher.name}`} />
      {c.reportedAt ? (
        <Alert tone="warning" className="mb-4">{t("reportedBy", { name: reporter.name })} « {c.reportReason} »</Alert>
      ) : (
        <Alert tone="info" className="mb-4">{t("closed")}</Alert>
      )}
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href={`/admin/users/${c.studentId}`} className="text-primary hover:underline">{t("openUser", { name: c.student.name })}</Link>
        <span aria-hidden>·</span>
        <Link href={`/admin/users/${c.teacherId}`} className="text-primary hover:underline">{t("openUser", { name: c.teacher.name })}</Link>
      </div>
      <ol className="space-y-2 rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-sm">
        {c.messages.map((m) => (
          <li key={m.id}>
            <span className="font-medium">{m.senderId === c.studentId ? c.student.name : c.teacher.name}</span>
            <span className="text-xs text-muted"> · {fmt.format(m.createdAt)}{m.redacted ? ` · ${t("redacted")}` : ""}</span>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ol>
      {c.reportedAt && (
        <form action={dismissReportAction.bind(null, c.id)} className="mt-4">
          <Button variant="secondary">{t("close")}</Button>
        </form>
      )}
    </DashboardShell>
  );
}

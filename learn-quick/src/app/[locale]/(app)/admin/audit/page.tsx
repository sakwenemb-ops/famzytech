import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireRole } from "@/server/session";
import { DashboardShell, PageTitle } from "@/components/dashboard/shell";
import { adminNav } from "@/components/dashboard/nav";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { AuditList } from "@/components/admin/audit-list";

const PAGE = 50;

export default async function AdminAudit({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ action?: string; page?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const t = await getTranslations("audit");
  const td = await getTranslations("dashboard");
  const actions = (await db.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } })).map((a) => a.action);
  const action = actions.find((a) => a === sp.action);
  const page = Math.max(1, Number(sp.page) || 1);
  const where = action ? { action } : {};
  const [entries, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { actor: { select: { name: true } } } }),
    db.auditLog.count({ where }),
  ]);
  const qs = (p: number) => `/admin/audit?${new URLSearchParams({ ...(action && { action }), page: String(p) })}`;

  return (
    <DashboardShell nav={adminNav(td)} active="/admin/audit">
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <form className="mb-4 flex gap-2">
        <label htmlFor="action" className="sr-only">{t("filter")}</label>
        <Select id="action" name="action" defaultValue={action ?? ""}>
          <option value="">{t("all")}</option>
          {actions.map((a) => <option key={a} value={a}>{t.has(`actions.${a}`) ? t(`actions.${a}`) : a}</option>)}
        </Select>
        <Button type="submit" variant="secondary">{t("filter")}</Button>
      </form>
      <Card><CardBody><AuditList entries={entries} timeZone={admin.timeZone} /></CardBody></Card>
      {total > PAGE && (
        <nav className="mt-4 flex justify-between text-sm" aria-label={t("pages")}>
          {page > 1 ? <Link href={qs(page - 1)} className="text-primary">← {t("newer")}</Link> : <span />}
          {page * PAGE < total && <Link href={qs(page + 1)} className="text-primary">{t("older")} →</Link>}
        </nav>
      )}
    </DashboardShell>
  );
}

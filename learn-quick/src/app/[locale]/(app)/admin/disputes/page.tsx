import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireRole } from "@/server/session";
import { DashboardShell, EmptyState, PageTitle } from "@/components/dashboard/shell";
import { adminNav } from "@/components/dashboard/nav";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

const tone = { OPEN: "warning", RESOLVED_REFUND: "success", RESOLVED_NO_REFUND: "neutral" } as const;

export default async function AdminDisputes({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const t = await getTranslations("disputes");
  const td = await getTranslations("dashboard");
  const format = await getFormatter();
  const include = { booking: { include: { student: { include: { user: { select: { name: true } } } }, teacher: { include: { user: { select: { name: true } } } } } } } as const;
  const [open, closed] = await Promise.all([
    db.dispute.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, include }),
    db.dispute.findMany({ where: { status: { not: "OPEN" } }, orderBy: { resolvedAt: "desc" }, take: 30, include }),
  ]);
  const list = (items: typeof open) => (
    <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
      {items.map((d) => (
        <li key={d.id}>
          <Link href={`/admin/disputes/${d.id}`} className="block px-4 py-3 hover:bg-surface-2">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{d.booking.student.user.name} → {d.booking.teacher.user.name}</span>
              <Badge tone={tone[d.status]}>{t(`status.${d.status}`)}</Badge>
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted">{d.reason}</span>
            <span className="block text-xs text-muted">{format.relativeTime(d.createdAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <DashboardShell nav={adminNav(td)} active="/admin/disputes">
      <PageTitle title={t("adminTitle")} subtitle={t("adminSubtitle")} />
      <h2 className="mb-2 font-semibold">{t("toDecide", { count: open.length })}</h2>
      {open.length ? list(open) : <EmptyState text={t("noneOpen")} />}
      {closed.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-semibold">{t("decided")}</h2>
          {list(closed)}
        </>
      )}
    </DashboardShell>
  );
}

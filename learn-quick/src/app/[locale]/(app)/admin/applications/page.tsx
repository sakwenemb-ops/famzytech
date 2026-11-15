import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { ApplicationStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/session";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { DashboardShell, EmptyState, PageTitle } from "@/components/dashboard/shell";
import { adminNav } from "@/components/dashboard/nav";
import { statusTone } from "@/components/admin/status";

const FILTERS: Record<string, ApplicationStatus[] | null> = {
  waiting: ["SUBMITTED", "UNDER_REVIEW"],
  changes: ["CHANGES_REQUESTED"],
  approved: ["APPROVED"],
  rejected: ["REJECTED"],
  draft: ["DRAFT"],
  all: null,
};

export default async function ApplicationsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ filter?: string }> }) {
  const { locale } = await params;
  const { filter: f } = await searchParams;
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const filter = f && f in FILTERS ? f : "waiting";
  const t = await getTranslations("review");
  const td = await getTranslations("dashboard");
  const to = await getTranslations("options");
  const format = await getFormatter();

  const statuses = FILTERS[filter];
  const [apps, counts] = await Promise.all([
    db.teacherApplication.findMany({
      where: statuses ? { status: { in: statuses } } : {},
      // Oldest submissions first, so nobody waits too long
      orderBy: [{ submittedAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 100,
      include: { teacher: { include: { user: { select: { name: true, email: true, phone: true } } } } },
    }),
    db.teacherApplication.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (k: string) => {
    const s = FILTERS[k];
    return counts.filter((c) => !s || s.includes(c.status)).reduce((n, c) => n + c._count, 0);
  };

  return (
    <DashboardShell nav={adminNav(td)} active="/admin/applications">
      <PageTitle title={t("listTitle")} subtitle={t("listSubtitle")} />
      <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label={t("listTitle")}>
        {Object.keys(FILTERS).map((k) => (
          <Link
            key={k}
            href={{ pathname: "/admin/applications", query: { filter: k } }}
            aria-current={k === filter ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm",
              k === filter ? "border-primary bg-primary-soft font-medium text-primary" : "border-border text-muted hover:bg-surface-2",
            )}
          >
            {t(`filters.${k}`)} <span className="tabular-nums">({count(k)})</span>
          </Link>
        ))}
      </nav>
      <Card>
        <CardBody className="p-0">
          {apps.length === 0 ? (
            <div className="p-5"><EmptyState text={t("empty")} /></div>
          ) : (
            <ul className="divide-y divide-border">
              {apps.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/applications/${a.id}`} className="flex items-center gap-3 p-4 hover:bg-surface-2">
                    <Avatar name={a.teacher.user.name} src={a.teacher.photoUrl} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.teacher.user.name}</p>
                      <p className="truncate text-sm text-muted">
                        {a.teacher.subjects.map((s) => to(`languages.${s}`)).join(", ") || a.teacher.user.email || a.teacher.user.phone}
                        {a.submittedAt && ` · ${t("submitted")} ${format.dateTime(a.submittedAt, { dateStyle: "medium" })}`}
                        {a.round > 1 && ` · ${t("round", { n: a.round })}`}
                      </p>
                    </div>
                    <Badge tone={statusTone[a.status]}>{t(`status.${a.status}`)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </DashboardShell>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ApplicationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { formatXaf } from "@/lib/utils";
import { requireRole } from "@/server/session";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell, EmptyState, PageTitle, Stat } from "@/components/dashboard/shell";
import { teacherNav } from "@/components/dashboard/nav";

const TOTAL_STEPS = 10;
const tone: Record<ApplicationStatus, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SUBMITTED: "primary",
  UNDER_REVIEW: "primary",
  CHANGES_REQUESTED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export default async function TeacherDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");
  const t = await getTranslations("dashboard");
  const tp = await getTranslations("teacherProfile");
  const loc = locale as "en" | "fr";

  const teacher = await db.teacherProfile.findUnique({ where: { userId: user.id }, include: { application: true } });
  const app = teacher?.application;
  const status = app?.status ?? "DRAFT";
  const [upcoming, pending, available] = await Promise.all([
    teacher
      ? db.booking.findMany({
          where: { teacherId: teacher.id, status: "CONFIRMED", endsAt: { gt: new Date() } },
          orderBy: { startsAt: "asc" },
          take: 5,
          include: { student: { include: { user: { select: { name: true } } } } },
        })
      : [],
    db.ledgerAccount.findUnique({ where: { userId_type: { userId: user.id, type: "TEACHER_PENDING" } } }),
    db.ledgerAccount.findUnique({ where: { userId_type: { userId: user.id, type: "TEACHER_AVAILABLE" } } }),
  ]);
  const done = app?.completedSteps.length ?? 0;

  return (
    <DashboardShell nav={teacherNav(t)} active="/teacher">
      <PageTitle title={t("hello", { name: user.name.split(" ")[0] })} subtitle={t("teacher.subtitle")} />

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">{t("teacher.applicationTitle")}</h2>
            <Badge tone={tone[status]}>{t(`teacher.status.${status}`)}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted">{t(`teacher.statusHelp.${status}`)}</p>
          {teacher && (
            <Link href={`/teachers/${teacher.id}`} className={buttonVariants({ variant: "link", className: "mt-2 text-sm" })}>
              {teacher.isPublished ? tp("viewPublic") : tp("preview")}
            </Link>
          )}
          {status !== "DRAFT" && status !== "CHANGES_REQUESTED" && (
            <Link href="/teacher/application" className={buttonVariants({ variant: "link", className: "ml-4 mt-2 text-sm" })}>
              {t("teacher.viewApplication")}
            </Link>
          )}
          {(status === "DRAFT" || status === "CHANGES_REQUESTED") && (
            <>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL_STEPS} aria-valuenow={done}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${(done / TOTAL_STEPS) * 100}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-muted">{t("teacher.stepsDone", { done, total: TOTAL_STEPS })}</span>
                <Link href="/teacher/application" className={buttonVariants({ size: "sm" })}>
                  {t("teacher.continueApplication")}
                </Link>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat label={t("teacher.upcoming")} value={upcoming.length} />
        <Stat label={t("teacher.pending")} value={formatXaf(pending?.balanceXaf ?? 0, loc)} />
        <Stat label={t("teacher.available")} value={formatXaf(available?.balanceXaf ?? 0, loc)} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("teacher.upcoming")}</CardTitle>
        </CardHeader>
        <CardBody>
          {upcoming.length === 0 ? (
            <EmptyState text={t("teacher.noUpcoming")} />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {upcoming.map((b) => (
                <li key={b.id} className="flex justify-between gap-3 py-2.5">
                  <span className="font-medium capitalize">
                    {new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: user.timeZone }).format(b.startsAt)}
                  </span>
                  <span className="text-muted">{b.student.user.name}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </DashboardShell>
  );
}

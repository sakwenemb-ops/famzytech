import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatXaf } from "@/lib/utils";
import { requireRole } from "@/server/session";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell, EmptyState, PageTitle, Stat } from "@/components/dashboard/shell";
import { studentNav } from "@/components/dashboard/nav";

export default async function StudentDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");
  const t = await getTranslations("dashboard");
  const format = await getFormatter();

  const profile = await db.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  const [upcoming, wallet, testsTaken] = await Promise.all([
    profile
      ? db.booking.findMany({
          where: { studentId: profile.id, status: "CONFIRMED", startsAt: { gte: new Date() } },
          orderBy: { startsAt: "asc" },
          take: 5,
          include: { teacher: { include: { user: { select: { name: true } } } } },
        })
      : [],
    db.ledgerAccount.findUnique({ where: { userId_type: { userId: user.id, type: "STUDENT_WALLET" } } }),
    db.testAttempt.count({ where: { userId: user.id, status: { in: ["GRADED", "REVIEWED"] } } }),
  ]);

  return (
    <DashboardShell nav={studentNav(t)} active="/student">
      <PageTitle title={t("hello", { name: user.name.split(" ")[0] })} subtitle={t("student.subtitle")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("student.upcoming")} value={upcoming.length} />
        <Stat label={t("student.walletBalance")} value={formatXaf(wallet?.balanceXaf ?? 0, locale as "en" | "fr")} />
        <Stat label={t("student.testsTaken")} value={testsTaken} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("student.upcoming")}</CardTitle>
        </CardHeader>
        <CardBody>
          {upcoming.length === 0 ? (
            <EmptyState
              text={t("student.noUpcoming")}
              action={<Link href="/teachers" className={buttonVariants({ size: "sm" })}>{t("student.findTeacher")}</Link>}
            />
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium">{b.teacher.user.name}</span>
                  <span className="text-muted">
                    {format.dateTime(b.startsAt, { dateStyle: "medium", timeStyle: "short", timeZone: user.timeZone })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <Card className="mt-4">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">{t("student.practise")}</p>
          <Link href="/library" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            {t("library")}
          </Link>
        </CardBody>
      </Card>
    </DashboardShell>
  );
}

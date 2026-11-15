import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatXaf } from "@/lib/utils";
import { requireRole } from "@/server/session";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell, EmptyState, PageTitle, Stat } from "@/components/dashboard/shell";
import { Avatar } from "@/components/ui/avatar";
import { studentNav } from "@/components/dashboard/nav";

export default async function StudentDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");
  const t = await getTranslations("dashboard");
  const format = await getFormatter();

  const profile = await db.studentProfile.findUnique({ where: { userId: user.id } });
  const tl = await getTranslations("learning");
  const to = await getTranslations("options");
  const [upcoming, wallet, testsTaken, favorites] = await Promise.all([
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
    profile
      ? db.favoriteTeacher.findMany({
          where: { studentId: profile.id, teacher: { isPublished: true } },
          orderBy: { createdAt: "desc" },
          take: 6,
          include: { teacher: { include: { user: { select: { name: true } } } } },
        })
      : [],
  ]);
  const learning = profile?.learningLanguages ?? [];

  return (
    <DashboardShell nav={studentNav(t)} active="/student">
      <PageTitle
        title={t("hello", { name: user.name.split(" ")[0] })}
        subtitle={learning.length ? tl("summary", { languages: learning.map((l) => to(`languages.${l}`).toLowerCase()).join(", ") }) : t("student.subtitle")}
      />
      {learning.length === 0 && (
        <Card className="mb-6 border-primary/30 bg-primary-soft">
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">{tl("reminderTitle")}</h2>
              <p className="mt-0.5 text-sm text-muted">{tl("reminderBody")}</p>
            </div>
            <Link href="/student/welcome" className={buttonVariants({ size: "sm", className: "shrink-0" })}>{tl("reminderCta")}</Link>
          </CardBody>
        </Card>
      )}
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
        <CardHeader>
          <CardTitle>{t("student.favorites")}</CardTitle>
        </CardHeader>
        <CardBody>
          {favorites.length === 0 ? (
            <p className="text-sm text-muted">{t("student.noFavorites")}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {favorites.map(({ teacher }) => (
                <li key={teacher.id}>
                  <Link href={`/teachers/${teacher.id}`} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border p-3 hover:bg-surface-2">
                    <Avatar name={teacher.user.name} src={teacher.photoUrl} size={40} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{teacher.user.name}</span>
                      <span className="block text-sm text-muted">
                        {teacher.subjects.map((s) => to(`languages.${s}`)).join(", ")}
                        {teacher.hourlyRateXaf != null && ` · ${formatXaf(teacher.hourlyRateXaf, locale as "en" | "fr")}`}
                      </span>
                    </span>
                  </Link>
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

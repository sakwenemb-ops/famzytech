import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireRole } from "@/server/session";
import { saveWeeklyHoursAction } from "@/server/booking-actions";
import { DashboardShell, EmptyState, PageTitle } from "@/components/dashboard/shell";
import { teacherNav } from "@/components/dashboard/nav";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AvailabilityStep } from "@/components/application/steps/availability";
import { TimeOff } from "@/components/teacher/time-off";

export default async function TeacherCalendarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");
  const t = await getTranslations("calendar");
  const td = await getTranslations("dashboard");
  const tl = await getTranslations("lessons");
  const teacher = await db.teacherProfile.findUniqueOrThrow({
    where: { userId: user.id },
    include: {
      availability: { orderBy: [{ weekday: "asc" }, { startMin: "asc" }] },
      exceptions: { where: { endsAt: { gt: new Date() }, available: false }, orderBy: { startsAt: "asc" } },
      bookings: { where: { status: "CONFIRMED", endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 8, include: { student: { include: { user: { select: { name: true } } } } } },
    },
  });
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: user.timeZone });
  const when = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: user.timeZone });

  return (
    <DashboardShell nav={teacherNav(td)} active="/teacher/calendar">
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>{t("upcoming")}</CardTitle></CardHeader>
          <CardBody>
            {teacher.bookings.length === 0 ? (
              <EmptyState text={tl("none")} />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {teacher.bookings.map((b) => (
                  <li key={b.id} className="flex justify-between gap-3 py-2">
                    <span className="font-medium capitalize">{when.format(b.startsAt)}</span>
                    <span className="text-muted">{b.student.user.name} · {tl(`types.${b.type}`)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("weekly")}</CardTitle>
            <p className="mt-1 text-sm text-muted">{t("weeklyHint")}</p>
          </CardHeader>
          <CardBody>
            <AvailabilityStep
              standalone
              action={saveWeeklyHoursAction}
              timeZone={user.timeZone}
              defaults={teacher.availability.map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("timeOff")}</CardTitle>
            <p className="mt-1 text-sm text-muted">{t("timeOffHint")}</p>
          </CardHeader>
          <CardBody>
            <TimeOff
              items={teacher.exceptions.map((e) => {
                const last = new Date(e.endsAt.getTime() - 1);
                const a = day.format(e.startsAt), b = day.format(last);
                return { id: e.id, label: a === b ? a : `${a} – ${b}` };
              })}
            />
          </CardBody>
        </Card>
      </div>
    </DashboardShell>
  );
}

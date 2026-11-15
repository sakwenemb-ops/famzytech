import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/session";
import { DashboardShell, PageTitle } from "@/components/dashboard/shell";
import { studentNav } from "@/components/dashboard/nav";
import { LessonList, PackList } from "@/components/booking/lesson-list";
import { Alert } from "@/components/ui/alert";

export default async function StudentLessonsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ booked?: string }> }) {
  const { locale } = await params;
  const { booked } = await searchParams;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");
  const t = await getTranslations("dashboard");
  const tl = await getTranslations("lessons");
  return (
    <DashboardShell nav={studentNav(t)} active="/student/lessons">
      <PageTitle title={tl("title")} />
      {booked && <Alert tone="success" className="mb-4">{tl("bookedBanner")}</Alert>}
      <div className="space-y-4">
        <PackList user={user} />
        <LessonList user={user} role="student" />
      </div>
    </DashboardShell>
  );
}

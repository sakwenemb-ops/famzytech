import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/session";
import { DashboardShell, PageTitle } from "@/components/dashboard/shell";
import { teacherNav } from "@/components/dashboard/nav";
import { LessonList } from "@/components/booking/lesson-list";

export default async function TeacherLessonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");
  const t = await getTranslations("dashboard");
  const tl = await getTranslations("lessons");
  return (
    <DashboardShell nav={teacherNav(t)} active="/teacher/lessons">
      <PageTitle title={tl("title")} />
      <LessonList user={user} role="teacher" />
    </DashboardShell>
  );
}

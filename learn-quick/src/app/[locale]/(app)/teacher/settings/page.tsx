import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/session";
import { DashboardShell } from "@/components/dashboard/shell";
import { teacherNav } from "@/components/dashboard/nav";
import { SettingsContent } from "@/components/settings/settings-page";

export default async function TeacherSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");
  const t = await getTranslations("dashboard");

  return (
    <DashboardShell nav={teacherNav(t)} active="/teacher/settings">
      <SettingsContent user={user} />
    </DashboardShell>
  );
}

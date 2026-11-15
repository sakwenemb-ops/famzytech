import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/session";
import { getLearningDefaults } from "@/server/student";
import { DashboardShell } from "@/components/dashboard/shell";
import { studentNav } from "@/components/dashboard/nav";
import { SettingsContent } from "@/components/settings/settings-page";
import { LearningForm } from "@/components/student/learning-form";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StudentSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");
  const t = await getTranslations("dashboard");
  const tl = await getTranslations("learning");
  const defaults = await getLearningDefaults(user.id);

  return (
    <DashboardShell nav={studentNav(t)} active="/student/settings">
      <SettingsContent
        user={user}
        extra={
          <Card id="learning">
            <CardHeader><CardTitle>{tl("title")}</CardTitle></CardHeader>
            <CardBody><LearningForm defaults={defaults} mode="settings" /></CardBody>
          </Card>
        }
      />
    </DashboardShell>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireRole } from "@/server/session";
import { DEFAULTS } from "@/server/settings";
import { SETTING_RULES, type EditableSetting } from "@/lib/setting-rules";
import { DashboardShell, PageTitle } from "@/components/dashboard/shell";
import { adminNav } from "@/components/dashboard/nav";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function AdminSettings({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const t = await getTranslations("adminSettings");
  const td = await getTranslations("dashboard");
  const rows = Object.fromEntries((await db.platformSetting.findMany()).map((s) => [s.key, s.value]));
  const values = Object.fromEntries((Object.keys(SETTING_RULES) as EditableSetting[]).map((k) => [k, (rows[k] ?? DEFAULTS[k]) as number | boolean])) as Record<EditableSetting, number | boolean>;
  return (
    <DashboardShell nav={adminNav(td)} active="/admin/settings">
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <SettingsForm values={values} />
    </DashboardShell>
  );
}

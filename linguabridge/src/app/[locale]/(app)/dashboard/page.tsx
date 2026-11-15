import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { dashboardPath, requireUser } from "@/server/session";

/** Sends each user to the dashboard for their role. */
export default async function DashboardRedirect() {
  const user = await requireUser();
  redirect({ href: dashboardPath(user.role), locale: await getLocale() });
}

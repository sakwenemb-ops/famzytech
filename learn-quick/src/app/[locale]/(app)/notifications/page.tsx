import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/server/session";
import { markAllReadAction, openNotificationAction } from "@/server/notification-actions";
import { DashboardShell, EmptyState, PageTitle } from "@/components/dashboard/shell";
import { navFor } from "@/components/dashboard/nav";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const PAGE = 30;

export default async function NotificationsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("notifications");
  const td = await getTranslations("dashboard");
  const format = await getFormatter();
  const page = Math.max(1, Number((await searchParams).page) || 1);

  const [items, total, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.notification.count({ where: { userId: user.id } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const settings = user.role === "ADMIN" ? null : user.role === "TEACHER" ? "/teacher/settings#notifications" : "/student/settings#notifications";

  return (
    <DashboardShell nav={navFor(user.role, td)} active="/notifications">
      <PageTitle title={t("title")} subtitle={t("subtitle", { count: unread })} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {settings ? <Link href={settings} className="text-sm text-primary hover:underline">{t("preferences")}</Link> : <span />}
        {unread > 0 && (
          <form action={markAllReadAction}>
            <Button variant="secondary" size="sm">{t("markAllRead")}</Button>
          </form>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState text={t("empty")} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
          {items.map((n) => (
            <li key={n.id} data-notification={n.type}>
              <form action={openNotificationAction.bind(null, n.id)}>
                <button className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2", !n.readAt && "bg-primary-soft/40")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block", !n.readAt && "font-semibold")}>
                      {n.title}
                      {!n.readAt && <span className="sr-only"> ({t("unread")})</span>}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                    <span className="mt-1 block text-xs text-muted">{format.relativeTime(n.createdAt)}</span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {total > PAGE && (
        <nav className="mt-4 flex justify-between text-sm" aria-label={t("pages")}>
          {page > 1 ? <Link href={`/notifications?page=${page - 1}`} className="text-primary">← {t("newer")}</Link> : <span />}
          {page * PAGE < total && <Link href={`/notifications?page=${page + 1}`} className="text-primary">{t("older")} →</Link>}
        </nav>
      )}
    </DashboardShell>
  );
}

import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/server/session";
import { inbox } from "@/server/messaging";
import { DashboardShell, EmptyState, PageTitle } from "@/components/dashboard/shell";
import { navFor } from "@/components/dashboard/nav";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { LiveRefresh } from "@/components/messages/live-refresh";
import { cn } from "@/lib/utils";

export default async function MessagesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT", "TEACHER");
  const t = await getTranslations("messages");
  const td = await getTranslations("dashboard");
  const format = await getFormatter();
  const { error } = await searchParams;
  const list = await inbox(user);

  return (
    <DashboardShell nav={navFor(user.role, td)} active="/messages">
      <LiveRefresh />
      <PageTitle title={t("title")} subtitle={t(user.role === "TEACHER" ? "subtitleTeacher" : "subtitleStudent")} />
      {error && <Alert tone="danger" className="mb-4">{t(`errors.${["not_allowed", "too_many", "not_found"].includes(error) ? error : "not_allowed"}`)}</Alert>}
      {list.length === 0 ? (
        <EmptyState
          text={t(user.role === "TEACHER" ? "emptyTeacher" : "emptyStudent")}
          action={user.role === "STUDENT" && <Link href="/teachers" className={buttonVariants({ size: "sm" })}>{t("findTeacher")}</Link>}
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
          {list.map((c) => {
            const other = c.studentId === user.id ? { name: c.teacher.name, photo: c.teacher.teacherProfile?.photoUrl ?? c.teacher.image } : { name: c.student.name, photo: c.student.image };
            const last = c.messages[0];
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2" data-conversation={c.id}>
                  <Avatar name={other.name} src={other.photo} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate", c.unread > 0 && "font-semibold")}>{other.name}</span>
                      <span className="shrink-0 text-xs text-muted">{format.relativeTime(c.lastMessageAt)}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", c.unread > 0 ? "text-fg" : "text-muted")}>
                        {last ? `${last.senderId === user.id ? `${t("you")} : ` : ""}${last.body}` : t("noMessagesYet")}
                      </span>
                      {c.unread > 0 && (
                        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white">
                          {c.unread}
                          <span className="sr-only"> {t("unread")}</span>
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}

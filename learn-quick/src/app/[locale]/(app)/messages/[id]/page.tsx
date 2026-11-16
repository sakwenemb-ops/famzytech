import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/server/session";
import { contactAllowed, conversationFor, markRead } from "@/server/messaging";
import { DashboardShell } from "@/components/dashboard/shell";
import { navFor } from "@/components/dashboard/nav";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import { Thread } from "@/components/messages/thread";
import { ReportConversation } from "@/components/messages/report";

export default async function ConversationPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT", "TEACHER");
  const c = await conversationFor(user, id);
  if (!c) notFound();
  const t = await getTranslations("messages");
  const td = await getTranslations("dashboard");

  await markRead(user, c.id);
  const [messages, unlocked, teacherProfile] = await Promise.all([
    db.message.findMany({ where: { conversationId: c.id }, orderBy: { createdAt: "desc" }, take: 200 }),
    contactAllowed(c),
    db.teacherProfile.findUnique({ where: { userId: c.teacherId }, select: { id: true, photoUrl: true } }),
  ]);
  const other = c.studentId === user.id ? c.teacher : c.student;
  const photo = other.id === c.teacherId ? (teacherProfile?.photoUrl ?? other.image) : other.image;

  return (
    <DashboardShell nav={navFor(user.role, td)} active="/messages">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/messages" className="grid size-9 place-items-center rounded-[var(--radius-md)] hover:bg-surface-2" aria-label={t("back")}>
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <Avatar name={other.name} src={photo} size={40} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{other.name}</h1>
          {other.id === c.teacherId && teacherProfile && user.role === "STUDENT" && (
            <Link href={`/teachers/${teacherProfile.id}`} className="text-sm text-primary hover:underline">{t("viewProfile")}</Link>
          )}
        </div>
        <ReportConversation conversationId={c.id} reported={Boolean(c.reportedAt)} />
      </div>
      {other.status !== "ACTIVE" && <Alert tone="warning" className="mb-3">{t("unavailable")}</Alert>}
      {!unlocked && <p className="mb-3 rounded-[var(--radius-md)] bg-surface-2 px-3 py-2 text-[13px] text-muted">{t("contactHidden")}</p>}
      <Thread
        conversationId={c.id}
        me={user.id}
        canSend={other.status === "ACTIVE"}
        timeZone={user.timeZone}
        messages={messages.reverse().map((m) => ({ id: m.id, mine: m.senderId === user.id, body: m.body, at: m.createdAt.toISOString(), read: Boolean(m.readAt), redacted: m.redacted }))}
      />
    </DashboardShell>
  );
}

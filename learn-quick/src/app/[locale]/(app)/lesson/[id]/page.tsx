import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/session";
import { isRoomOpen, lessonFor, roomWindow } from "@/server/lesson-room";
import { iceServers } from "@/server/ice";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Classroom } from "@/components/classroom/classroom";
import { RecordBoard } from "@/components/classroom/record-board";
import type { Stroke } from "@/components/classroom/whiteboard";

export default async function LessonPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser();
  const found = await lessonFor(user, id);
  if (!found) notFound();
  const { b, lesson, role } = found;
  const t = await getTranslations("classroom");
  const backHref = role === "teacher" ? "/teacher/lessons" : role === "student" ? "/student/lessons" : "/admin";
  const otherUser = role === "teacher" ? b.student.user : b.teacher.user;
  const chat = await db.lessonChatMessage.findMany({ where: { lessonId: lesson.id }, orderBy: { createdAt: "asc" }, take: 500 });
  const strokes = ((lesson.whiteboardState as { strokes?: Stroke[] } | null)?.strokes ?? []) as Stroke[];
  const fmt = (d: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone: user.timeZone }).format(d);

  // Live classroom: only the lesson's student and teacher, only while it is open
  if (role !== "admin" && isRoomOpen(b)) {
    return (
      <Classroom
        bookingId={b.id}
        role={role}
        me={{ id: user.id, name: user.name }}
        other={{ id: otherUser.id, name: otherUser.name }}
        iceServers={iceServers()}
        backHref={backHref}
        initial={{
          chat: chat.map((m) => ({ id: m.id, from: m.senderId, text: m.body, fileId: m.fileKey, at: m.createdAt.toISOString() })),
          strokes,
          notes: lesson.sharedNotes ?? "",
        }}
      />
    );
  }

  const before = new Date() < roomWindow(b).opensAt && b.status === "CONFIRMED";
  const attendance = await db.lessonAttendance.findMany({ where: { lessonId: lesson.id }, orderBy: { joinedAt: "asc" } });
  const names = new Map([[b.student.userId, b.student.user.name], [b.teacher.userId, b.teacher.user.name]]);
  const firstJoin = new Map<string, Date>();
  for (const a of attendance) if (!firstJoin.has(a.userId)) firstJoin.set(a.userId, a.joinedAt);
  const time = (d: Date) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: user.timeZone }).format(d);

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("title", { name: role === "admin" ? `${b.student.user.name} · ${b.teacher.user.name}` : otherUser.name })}</h1>
      <p className="text-muted">{fmt(b.startsAt)}</p>

      {before ? (
        <Alert tone="info">{t("notOpenYet", { time: fmt(roomWindow(b).opensAt) })}</Alert>
      ) : (
        <>
          <h2 className="pt-2 text-lg font-semibold">{t("record")}</h2>
          {(lesson.teacherNotes || lesson.homework) && (
            <Card>
              <CardBody className="space-y-3 text-sm">
                {lesson.teacherNotes && <div><p className="font-medium">{t("teacherNotes")}</p><p className="mt-1 whitespace-pre-line">{lesson.teacherNotes}</p></div>}
                {lesson.homework && <div><p className="font-medium">{t("homework")}</p><p className="mt-1 whitespace-pre-line">{lesson.homework}</p></div>}
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>{t("attendance")}</CardTitle></CardHeader>
            <CardBody className="text-sm">
              {firstJoin.size === 0 ? <p className="text-muted">{t("nobody")}</p> : (
                <ul className="space-y-1">{[...firstJoin].map(([uid, at]) => <li key={uid}>{t("joinedAt", { name: names.get(uid) ?? "?", time: time(at) })}</li>)}</ul>
              )}
            </CardBody>
          </Card>
          {lesson.sharedNotes && (
            <Card>
              <CardHeader><CardTitle>{t("sharedNotes")}</CardTitle></CardHeader>
              <CardBody><p className="whitespace-pre-line text-sm">{lesson.sharedNotes}</p></CardBody>
            </Card>
          )}
          {strokes.length > 0 && (
            <Card>
              <CardHeader><CardTitle>{t("board")}</CardTitle></CardHeader>
              <CardBody><RecordBoard strokes={strokes} /></CardBody>
            </Card>
          )}
          {chat.length > 0 && (
            <Card>
              <CardHeader><CardTitle>{t("chatHistory")}</CardTitle></CardHeader>
              <CardBody>
                <ul className="space-y-2 text-sm">
                  {chat.map((m) => (
                    <li key={m.id}>
                      <span className="text-muted">{time(m.createdAt)} · {names.get(m.senderId)}:</span>{" "}
                      {m.fileKey ? <a href={`/api/files/${m.fileKey}`} className="text-primary underline" target="_blank" rel="noreferrer">📎 {m.body}</a> : m.body}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </>
      )}
      <Link href={backHref} className={buttonVariants({ variant: "secondary" })}>{t("back")}</Link>
    </div>
  );
}

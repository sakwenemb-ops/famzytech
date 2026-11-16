import { getTranslations } from "next-intl/server";
import { CalendarPlus, MessageSquare } from "lucide-react";
import { startConversationAction } from "@/server/message-actions";
import type { User } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { cancelPolicy } from "@/server/booking";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/shell";
import { LessonActions } from "./lesson-actions";
import { JoinButton } from "./join-button";
import { NotesForm, ReviewForm } from "./after-lesson";
import { OpenDisputeForm, RespondDisputeForm } from "./dispute-forms";
import { canDispute } from "@/server/disputes";
import { CLOSE_AFTER_MIN, roomWindow } from "@/server/lesson-room";

const tone = { CONFIRMED: "success", COMPLETED: "neutral", HELD: "warning", NO_SHOW_STUDENT: "warning", NO_SHOW_TEACHER: "danger" } as const;

/** Upcoming and past lessons for a student or a teacher. */
export async function LessonList({ user, role }: { user: User; role: "student" | "teacher" }) {
  const t = await getTranslations("lessons");
  const ta = await getTranslations("afterLesson");
  const tc = await getTranslations("classroom");
  const profile =
    role === "student"
      ? await db.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
      : await db.teacherProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) return null;
  const mine = role === "student" ? { studentId: profile.id } : { teacherId: profile.id };
  const now = new Date();
  const include = { student: { include: { user: true } }, teacher: { include: { user: true } }, lesson: true, review: true, dispute: true } as const;
  // A lesson stays in "upcoming" until its classroom closes (30 minutes after the end)
  const roomClosed = new Date(now.getTime() - CLOSE_AFTER_MIN * 60_000);
  const [upcoming, past] = await Promise.all([
    db.booking.findMany({ where: { ...mine, status: "CONFIRMED", endsAt: { gt: roomClosed } }, orderBy: { startsAt: "asc" }, include }),
    db.booking.findMany({
      where: { ...mine, OR: [{ status: { in: ["COMPLETED", "CANCELLED_BY_STUDENT", "CANCELLED_BY_TEACHER", "NO_SHOW_STUDENT", "NO_SHOW_TEACHER", "DISPUTED"] } }, { status: "CONFIRMED", endsAt: { lte: roomClosed } }] },
      orderBy: { startsAt: "desc" },
      take: 30,
      include,
    }),
  ]);
  const { freeCancelHours } = await cancelPolicy();
  const td = await getTranslations("disputes");
  const disputable = new Set(role === "student" ? (await Promise.all(past.filter((b) => !b.dispute).map(async (b) => ((await canDispute(b, now)) ? b.id : null)))).filter(Boolean) : []);
  const fmt = new Intl.DateTimeFormat(user.locale, { dateStyle: "full", timeStyle: "short", timeZone: user.timeZone });

  const row = (b: (typeof upcoming)[number], isUpcoming: boolean) => {
    const other = role === "student" ? b.teacher.user : b.student.user;
    const photo = role === "student" ? b.teacher.photoUrl : other.image;
    return (
      <li key={b.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={other.name} src={photo} size={44} />
            <div className="min-w-0">
              <p className="font-medium">{fmt.format(b.startsAt)}</p>
              <p className="text-sm text-muted">
                {t(`types.${b.type}`)} {t("with", { name: other.name })}
              </p>
            </div>
          </div>
          <Badge tone={tone[b.status as keyof typeof tone] ?? "danger"}>{t(`status.${b.status}`)}</Badge>
        </div>
        {isUpcoming && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <a href={`/api/bookings/${b.id}/ics`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <CalendarPlus className="size-4" aria-hidden />
                {t("addToCalendar")}
              </a>
              <form action={startConversationAction.bind(null, other.id)}>
                <button className="inline-flex items-center gap-1.5 text-primary hover:underline">
                  <MessageSquare className="size-4" aria-hidden />
                  {t("message", { name: other.name })}
                </button>
              </form>
              <JoinButton bookingId={b.id} opensAt={roomWindow(b).opensAt.toISOString()} closesAt={roomWindow(b).closesAt.toISOString()} />
            </div>
            {b.startsAt > now && <LessonActions
              bookingId={b.id}
              teacherId={b.teacherId}
              role={role}
              startsAt={b.startsAt.toISOString()}
              freeCancelHours={freeCancelHours}
              timeZone={user.timeZone}
            />}
          </>
        )}
        {!isUpcoming && b.dispute && (
          <div className="space-y-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-2 text-sm" data-dispute={b.dispute.status}>
            <p className="font-medium">{td(`status.${b.dispute.status}`)}{b.dispute.refundPct ? ` (${b.dispute.refundPct} %)` : ""}</p>
            <p className="text-muted">{td("studentSaid")} « {b.dispute.reason} »</p>
            {b.dispute.teacherResponse && <p className="text-muted">{td("teacherSaid")} « {b.dispute.teacherResponse} »</p>}
            {b.dispute.resolution && <p>{td("decisionNote")} {b.dispute.resolution}</p>}
            {role === "student" && b.dispute.status === "OPEN" && <p className="text-muted">{td("opened")}</p>}
            {role === "teacher" && b.dispute.status === "OPEN" && !b.dispute.teacherResponse && <RespondDisputeForm disputeId={b.dispute.id} />}
          </div>
        )}
        {!isUpcoming && disputable.has(b.id) && b.releaseAt && <OpenDisputeForm bookingId={b.id} deadline={fmt.format(b.releaseAt)} />}
        {!isUpcoming && b.lesson && ["COMPLETED", "NO_SHOW_STUDENT", "NO_SHOW_TEACHER"].includes(b.status) && (
          <div className="space-y-3 text-sm">
            {b.status === "NO_SHOW_TEACHER" && <p className="text-muted">{ta(role === "student" ? "noShowTeacher" : "noShowTeacherTeacher")}</p>}
            {b.status === "NO_SHOW_STUDENT" && <p className="text-muted">{role === "student" ? ta("noShowStudent") : ta("noShowStudentTeacher")}</p>}
            <Link href={`/lesson/${b.id}`} className="inline-block text-primary hover:underline">{ta("viewRecord")}</Link>
            {role === "student" && b.lesson.homework && (
              <p className="rounded-[var(--radius-md)] bg-primary-soft px-3 py-2"><span className="font-medium">{tc("homework")} :</span> {b.lesson.homework}</p>
            )}
            {role === "student" && b.status === "COMPLETED" && !b.review && now.getTime() - b.endsAt.getTime() < 30 * 86_400_000 && (
              <ReviewForm bookingId={b.id} teacherName={b.teacher.user.name} />
            )}
            {role === "student" && b.review && (
              <p className="text-muted">{ta("yourReview")} : {"★".repeat(b.review.rating)}{"☆".repeat(5 - b.review.rating)}</p>
            )}
            {role === "teacher" && b.status !== "NO_SHOW_TEACHER" && (
              <NotesForm bookingId={b.id} studentName={b.student.user.name} defaults={{ teacherNotes: b.lesson.teacherNotes ?? "", homework: b.lesson.homework ?? "" }} />
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("upcoming")}</CardTitle>
          {role === "student" && <p className="mt-1 text-sm text-muted">{t("policy", { hours: freeCancelHours })}</p>}
        </CardHeader>
        <CardBody>
          {upcoming.length === 0 ? <EmptyState text={t("none")} /> : <ul className="divide-y divide-border">{upcoming.map((b) => row(b, true))}</ul>}
        </CardBody>
      </Card>
      {past.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("past")}</CardTitle></CardHeader>
          <CardBody><ul className="divide-y divide-border">{past.map((b) => row(b, false))}</ul></CardBody>
        </Card>
      )}
    </div>
  );
}

/** A student's lesson packs with lessons left. */
export async function PackList({ user }: { user: User }) {
  const t = await getTranslations("lessons");
  const sp = await db.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!sp) return null;
  const packs = (await db.lessonPackage.findMany({ where: { studentId: sp.id }, include: { teacher: { include: { user: { select: { name: true } } } } } }))
    .filter((p) => p.usedLessons < p.totalLessons);
  if (!packs.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle>{t("credits")}</CardTitle></CardHeader>
      <CardBody>
        <ul className="divide-y divide-border">
          {packs.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span>{t("creditsWith", { name: p.teacher.user.name, left: p.totalLessons - p.usedLessons, total: p.totalLessons })}</span>
              <Link href={`/teachers/${p.teacherId}`} className="font-medium text-primary hover:underline">{t("bookNext")}</Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

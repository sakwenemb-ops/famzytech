import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/session";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/** Calendar file (.ics) for a lesson, for the student or teacher of that lesson only. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const b = await db.booking.findUnique({
    where: { id },
    include: { student: { include: { user: true } }, teacher: { include: { user: true } } },
  });
  if (!user || !b || (b.student.userId !== user.id && b.teacher.userId !== user.id) || b.status !== "CONFIRMED") {
    return new Response("Not found", { status: 404 });
  }
  const other = b.student.userId === user.id ? b.teacher.user.name : b.student.user.name;
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const link = `${base}/${user.locale}/${b.student.userId === user.id ? "student" : "teacher"}/lessons`;
  const summary = user.locale === "fr" ? `Cours Learn Quick avec ${other}` : `Learn Quick lesson with ${other}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Learn Quick//Lessons//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@learnquick`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(b.startsAt)}`,
    `DTEND:${stamp(b.endsAt)}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(link)}`,
    `URL:${link}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(summary)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="learn-quick-lesson.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}

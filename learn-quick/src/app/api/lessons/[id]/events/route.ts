import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isVerified } from "@/server/session";
import { isRoomOpen, lessonFor } from "@/server/lesson-room";
import { present, publish, subscribe, type RoomEvent } from "@/server/realtime/hub";
import { MAX_STROKES, roomMessageSchema, type Stroke } from "@/server/realtime/room-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function participant(id: string) {
  const user = await getCurrentUser();
  if (!user || !isVerified(user)) return null;
  const found = await lessonFor(user, id);
  if (!found || found.role === "admin" || !isRoomOpen(found.b)) return null;
  return { user, ...found };
}

/** Live event stream (Server-Sent Events). Being connected is what counts as attendance. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await participant(id);
  if (!p) return new Response("Not found", { status: 404 });
  const { user, lesson, role } = p;

  const attendance = await db.lessonAttendance.create({
    data: { lessonId: lesson.id, userId: user.id, role: role === "teacher" ? "TEACHER" : "STUDENT", joinedAt: new Date() },
  });
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: RoomEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {}
      };
      unsubscribe = subscribe(id, { userId: user.id, send });
      // Tell the newcomer who is already here, and everyone else that they arrived
      send({ type: "hello", from: "server", payload: { present: present(id), you: user.id }, at: new Date().toISOString() });
      publish(id, { type: "joined", from: user.id, payload: { role } });
      // A comment every 15 s keeps mobile networks and proxies from closing the connection
      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {}
      }, 15_000);
    },
    cancel() {
      cleanup();
    },
  });

  let closed = false;
  async function cleanup() {
    if (closed) return;
    closed = true;
    clearInterval(keepAlive);
    unsubscribe();
    publish(id, { type: "left", from: user.id });
    await db.lessonAttendance.update({ where: { id: attendance.id }, data: { leftAt: new Date() } }).catch(() => undefined);
  }
  req.signal.addEventListener("abort", () => void cleanup());

  if (!lesson.startedAt) await db.lesson.update({ where: { id: lesson.id }, data: { startedAt: new Date() } }).catch(() => undefined);
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}

// Saving whiteboard strokes one after another per lesson (they edit the same JSON value)
const g = globalThis as unknown as { __lqWbLocks?: Map<string, Promise<unknown>> };
const locks = (g.__lqWbLocks ??= new Map());
function serial<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const next = (locks.get(key) ?? Promise.resolve()).then(fn, fn);
  locks.set(key, next.catch(() => undefined));
  return next;
}

/** Send a message into the room. It is checked, saved when it should be kept, then delivered. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await participant(id);
  if (!p) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { user, lesson, b } = p;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = roomMessageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const m = parsed.data;
  const other = user.id === b.student.userId ? b.teacher.userId : b.student.userId;

  switch (m.type) {
    case "signal":
      publish(id, { type: "signal", from: user.id, to: other, payload: m.payload });
      break;
    case "chat": {
      const msg = await db.lessonChatMessage.create({ data: { lessonId: lesson.id, senderId: user.id, body: m.payload.text } });
      publish(id, { type: "chat", from: user.id, payload: { id: msg.id, text: msg.body, at: msg.createdAt } });
      return NextResponse.json({ ok: true, id: msg.id, at: msg.createdAt });
    }
    case "file": {
      const doc = await db.document.findUnique({ where: { id: m.payload.docId } });
      if (!doc || doc.ownerId !== user.id || doc.kind !== "LESSON_FILE") return NextResponse.json({ error: "bad_request" }, { status: 400 });
      const msg = await db.lessonChatMessage.create({ data: { lessonId: lesson.id, senderId: user.id, body: m.payload.name, fileKey: doc.id } });
      publish(id, { type: "chat", from: user.id, payload: { id: msg.id, text: msg.body, fileId: doc.id, at: msg.createdAt } });
      return NextResponse.json({ ok: true, id: msg.id, at: msg.createdAt });
    }
    case "wb-live":
      publish(id, { type: "wb-live", from: user.id, payload: m.payload });
      break;
    case "wb":
    case "wb-clear":
      await serial(lesson.id, async () => {
        const current = await db.lesson.findUnique({ where: { id: lesson.id }, select: { whiteboardState: true } });
        const strokes = ((current?.whiteboardState as { strokes?: Stroke[] } | null)?.strokes ?? []) as Stroke[];
        const next = m.type === "wb-clear" ? [] : [...strokes, m.payload].slice(-MAX_STROKES);
        await db.lesson.update({ where: { id: lesson.id }, data: { whiteboardState: { strokes: next } } });
      });
      publish(id, { type: m.type, from: user.id, payload: m.type === "wb" ? m.payload : undefined });
      break;
    case "notes":
      await db.lesson.update({ where: { id: lesson.id }, data: { sharedNotes: m.payload.text } });
      publish(id, { type: "notes", from: user.id, payload: m.payload });
      break;
    case "media":
      publish(id, { type: "media", from: user.id, payload: m.payload });
      break;
  }
  return NextResponse.json({ ok: true });
}

import { getCurrentUser } from "@/server/session";
import { subscribe, type RoomEvent } from "@/server/realtime/hub";
import { userRoom } from "@/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live signal for one signed-in person: "something new" (notification or message). Carries no content. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let keepAlive: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    clearInterval(keepAlive);
    unsubscribe();
  };
  const stream = new ReadableStream({
    start(controller) {
      const write = (s: string) => {
        try {
          controller.enqueue(encoder.encode(s));
        } catch {
          stop();
        }
      };
      unsubscribe = subscribe(userRoom(user.id), { userId: user.id, send: (e: RoomEvent) => write(`data: ${JSON.stringify({ type: e.type, payload: e.payload })}\n\n`) });
      write("retry: 10000\n\n");
      keepAlive = setInterval(() => write(": ping\n\n"), 25_000);
    },
    cancel: stop,
  });
  req.signal.addEventListener("abort", stop);
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}

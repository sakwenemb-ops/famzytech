import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** For uptime monitors and the load balancer: 200 when the app and database answer. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

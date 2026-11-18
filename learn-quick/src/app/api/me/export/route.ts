import { getCurrentUser } from "@/server/session";
import { exportData } from "@/server/account";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

/** "Download my data": a JSON file with everything we hold about the signed-in person. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!rateLimit(`export:${user.id}`, 5, 3_600_000)) return new Response("Too many requests", { status: 429 });
  const data = await exportData(user);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="learn-quick-data-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

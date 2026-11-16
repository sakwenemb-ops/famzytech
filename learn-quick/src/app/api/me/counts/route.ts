import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/session";
import { unreadCounts } from "@/server/counts";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await unreadCounts(user.id), { headers: { "Cache-Control": "no-store" } });
}

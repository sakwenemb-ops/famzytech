import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/session";
import { readDocument } from "@/server/files";

export const runtime = "nodejs";

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return notFound();

  if (doc.isPrivate) {
    // Private files (ID, certificates): only the owner and admins. Others get 404, not 403,
    // so the response does not reveal that the file exists.
    const user = await getCurrentUser();
    if (!user || (user.id !== doc.ownerId && user.role !== "ADMIN")) return notFound();
  }

  const data = await readDocument(doc);
  if (!data) return notFound();

  const headers = new Headers({
    "Content-Type": doc.mimeType,
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    "Cache-Control": doc.isPrivate ? "private, no-store" : "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  });

  // Range requests let browsers seek in videos
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = data.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(new Uint8Array(data.subarray(start, end + 1)), { status: 206, headers });
  }

  headers.set("Content-Length", String(data.length));
  return new Response(new Uint8Array(data), { headers });
}

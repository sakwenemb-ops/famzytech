import { NextResponse } from "next/server";
import { DocumentKind } from "@prisma/client";
import { getCurrentUser, isVerified } from "@/server/session";
import { saveUpload } from "@/server/files";

export const runtime = "nodejs";

/** POST multipart/form-data with `kind` and `file`. Returns { id, url } or { error }. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !isVerified(user)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Reject very large bodies before reading them (largest allowed file is 100 MB)
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > 101 * 1024 * 1024) return NextResponse.json({ error: "too_large" }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const kind = form.get("kind");
  const file = form.get("file");
  if (typeof kind !== "string" || !(kind in DocumentKind) || !(file instanceof File)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const res = await saveUpload(user, kind as DocumentKind, file);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.error === "too_large" ? 413 : 400 });
  return NextResponse.json({ id: res.doc.id, url: `/api/files/${res.doc.id}` });
}

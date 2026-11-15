import "server-only";
import { randomUUID } from "node:crypto";
import type { DocumentKind, User } from "@prisma/client";
import { db } from "@/lib/db";
import { FILE_RULES, sniff } from "@/lib/file-rules";
import { storage } from "./storage";
import { decrypt, encrypt } from "./crypto";

export type UploadError = "kind_not_allowed" | "too_large" | "wrong_type" | "empty";

/** Which kinds each role may upload (only teachers, for their application, in this phase). */
const UPLOADERS: Record<string, DocumentKind[]> = {
  TEACHER: ["PROFILE_PHOTO", "INTRO_VIDEO", "CERTIFICATE", "DEGREE", "ID_FRONT", "ID_BACK", "ID_SELFIE"],
};

export async function saveUpload(user: User, kind: DocumentKind, file: File) {
  const rule = FILE_RULES[kind];
  if (!rule || !UPLOADERS[user.role]?.includes(kind)) return { error: "kind_not_allowed" as UploadError };
  if (file.size === 0) return { error: "empty" as UploadError };
  if (file.size > rule.maxBytes) return { error: "too_large" as UploadError };

  const data = Buffer.from(await file.arrayBuffer());
  const type = sniff(data.subarray(0, 32));
  if (!type || !rule.types.includes(type)) return { error: "wrong_type" as UploadError };

  const storageKey = `${rule.private ? "private" : "public"}/${kind.toLowerCase()}/${user.id}/${randomUUID()}`;
  await storage().put(storageKey, rule.encrypt ? encrypt(data) : data);
  const doc = await db.document.create({
    data: { ownerId: user.id, kind, storageKey, mimeType: type, sizeBytes: data.length, isPrivate: rule.private },
  });
  return { doc };
}

export const fileUrl = (docId: string) => `/api/files/${docId}`;

/** Read a file's bytes, decrypting when needed. */
export async function readDocument(doc: { kind: DocumentKind; storageKey: string }) {
  const raw = await storage().get(doc.storageKey);
  if (!raw) return null;
  return FILE_RULES[doc.kind]?.encrypt ? decrypt(raw) : raw;
}

/** Delete a file and its row. Used when a teacher replaces a file and by the purge job. */
export async function deleteDocument(id: string) {
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return;
  await storage().delete(doc.storageKey);
  await db.document.delete({ where: { id } }).catch(() => undefined);
}

/** Load a document that the user owns and that has the expected kind, or null. */
export async function ownedDocument(userId: string, id: string | undefined | null, kinds: DocumentKind[]) {
  if (!id) return null;
  const doc = await db.document.findUnique({ where: { id } });
  return doc && doc.ownerId === userId && kinds.includes(doc.kind) ? doc : null;
}

/** Delete identity documents whose purge date has passed. Run daily (see README). */
export async function purgeExpiredDocuments(now = new Date()) {
  const expired = await db.document.findMany({ where: { purgeAt: { lte: now } }, select: { id: true } });
  const ids = expired.map((d) => d.id);
  // Remove links to the deleted files so nothing points at a missing document
  for (const field of ["idFrontDocId", "idBackDocId", "idSelfieDocId"] as const) {
    await db.teacherApplication.updateMany({ where: { [field]: { in: ids } }, data: { [field]: null } });
  }
  for (const id of ids) await deleteDocument(id);
  return ids.length;
}

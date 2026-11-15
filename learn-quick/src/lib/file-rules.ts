import type { DocumentKind } from "@prisma/client";

export type SniffedType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | "video/mp4" | "video/webm" | "video/quicktime";

/**
 * Detect a file's real type from its first bytes. The browser's declared type and the
 * file name are ignored: they are easy to fake.
 */
export function sniff(b: Uint8Array): SniffedType | null {
  const at = (o: number, ...bytes: number[]) => bytes.every((x, i) => b[o + i] === x);
  const ascii = (o: number, s: string) => at(o, ...[...s].map((c) => c.charCodeAt(0)));
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(0, "%PDF-")) return "application/pdf";
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return "video/webm";
  if (ascii(4, "ftyp")) return ascii(8, "qt  ") ? "video/quicktime" : "video/mp4";
  return null;
}

const MB = 1024 * 1024;
const IMAGES: SniffedType[] = ["image/jpeg", "image/png", "image/webp"];
const DOCS: SniffedType[] = [...IMAGES, "application/pdf"];

export type FileRule = {
  types: SniffedType[];
  maxBytes: number;
  /** Private files: only the owner and admins can open them */
  private: boolean;
  /** Encrypted on disk */
  encrypt: boolean;
};

export const FILE_RULES: Partial<Record<DocumentKind, FileRule>> = {
  PROFILE_PHOTO: { types: IMAGES, maxBytes: 5 * MB, private: false, encrypt: false },
  INTRO_VIDEO: { types: ["video/mp4", "video/webm", "video/quicktime"], maxBytes: 100 * MB, private: false, encrypt: false },
  CERTIFICATE: { types: DOCS, maxBytes: 10 * MB, private: true, encrypt: true },
  DEGREE: { types: DOCS, maxBytes: 10 * MB, private: true, encrypt: true },
  ID_FRONT: { types: DOCS, maxBytes: 10 * MB, private: true, encrypt: true },
  ID_BACK: { types: DOCS, maxBytes: 10 * MB, private: true, encrypt: true },
  ID_SELFIE: { types: IMAGES, maxBytes: 10 * MB, private: true, encrypt: true },
};

/** The `accept` attribute for file inputs. */
export const acceptFor = (kind: DocumentKind) => (FILE_RULES[kind]?.types ?? []).join(",");

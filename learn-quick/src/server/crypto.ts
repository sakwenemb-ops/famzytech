import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  const secret = process.env.FILE_ENCRYPTION_KEY;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("FILE_ENCRYPTION_KEY must be set in production");
  }
  // 32-byte key; in development it is derived from AUTH_SECRET
  return createHash("sha256").update(secret ?? `files:${process.env.AUTH_SECRET ?? ""}`).digest();
}

/** AES-256-GCM. Output = 12-byte IV + 16-byte auth tag + ciphertext. */
export function encrypt(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}

export function decrypt(data: Buffer): Buffer {
  const d = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  d.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([d.update(data.subarray(28)), d.final()]);
}

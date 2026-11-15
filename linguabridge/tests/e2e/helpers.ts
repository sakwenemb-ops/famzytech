import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ quiet: true });
export const db = new PrismaClient();

/**
 * The production server never uses a fixed code, so tests replace the stored
 * code hash for this user with the hash of a known code.
 */
export async function setKnownCode(where: { email?: string; phone?: string }, code = "123456") {
  const user = await db.user.findFirstOrThrow({ where });
  const hash = createHash("sha256").update(`${code}:${process.env.AUTH_SECRET ?? ""}`).digest("hex");
  const token = await db.verificationToken.findFirstOrThrow({ where: { identifier: { endsWith: `:${user.id}` } } });
  await db.verificationToken.update({ where: { token: token.token }, data: { token: `${hash}:${user.id}`, attempts: 0 } });
  return code;
}

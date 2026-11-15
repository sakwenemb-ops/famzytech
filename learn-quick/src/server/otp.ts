import "server-only";
import { createHash, randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { sendEmail } from "./notify/email";
import { sendSms } from "./notify/sms";

const TTL_MIN = 10;
const RESEND_COOLDOWN_SEC = 60;
const MAX_ATTEMPTS = 5;

export type OtpChannel = "email" | "phone";

const identifier = (userId: string, channel: OtpChannel) => `otp:${channel}:${userId}`;
export const hashCode = (code: string) =>
  createHash("sha256").update(`${code}:${process.env.AUTH_SECRET ?? ""}`).digest("hex");

function newCode() {
  const fixed = process.env.OTP_FIXED_CODE;
  if (fixed && process.env.NODE_ENV !== "production") return fixed; // for tests
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export type SendResult = { ok: true } | { ok: false; error: "cooldown" | "no_contact" };

export async function sendOtp(
  user: { id: string; email: string | null; phone: string | null; locale: "en" | "fr" },
  channel: OtpChannel,
): Promise<SendResult> {
  const to = channel === "email" ? user.email : user.phone;
  if (!to) return { ok: false, error: "no_contact" };
  const id = identifier(user.id, channel);

  const existing = await db.verificationToken.findFirst({ where: { identifier: id }, orderBy: { expires: "desc" } });
  if (existing) {
    const sentAt = existing.expires.getTime() - TTL_MIN * 60_000;
    if (Date.now() - sentAt < RESEND_COOLDOWN_SEC * 1000) return { ok: false, error: "cooldown" };
  }

  const code = newCode();
  await db.$transaction([
    db.verificationToken.deleteMany({ where: { identifier: id } }),
    db.verificationToken.create({
      data: { identifier: id, token: hashCode(code) + ":" + user.id, expires: new Date(Date.now() + TTL_MIN * 60_000) },
    }),
  ]);

  const text =
    user.locale === "fr"
      ? `Votre code Learn Quick : ${code}. Il expire dans ${TTL_MIN} minutes.`
      : `Your Learn Quick code: ${code}. It expires in ${TTL_MIN} minutes.`;
  if (channel === "email") await sendEmail({ to, subject: text.split(":")[0], text });
  else await sendSms(to, text);
  return { ok: true };
}

export type VerifyResult = { ok: true } | { ok: false; error: "expired" | "wrong" | "too_many" };

export async function verifyOtp(userId: string, channel: OtpChannel, code: string): Promise<VerifyResult> {
  const id = identifier(userId, channel);
  const token = await db.verificationToken.findFirst({ where: { identifier: id } });
  if (!token || token.expires < new Date()) return { ok: false, error: "expired" };
  if (token.attempts >= MAX_ATTEMPTS) return { ok: false, error: "too_many" };

  if (token.token !== hashCode(code) + ":" + userId) {
    await db.verificationToken.update({ where: { token: token.token }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "wrong" };
  }

  await db.$transaction([
    db.verificationToken.deleteMany({ where: { identifier: id } }),
    db.user.update({
      where: { id: userId },
      data: channel === "email" ? { emailVerified: new Date() } : { phoneVerified: new Date() },
    }),
  ]);
  return { ok: true };
}

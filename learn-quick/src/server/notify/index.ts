import "server-only";
import { db } from "@/lib/db";
import { ALWAYS_SENT, categoryOf } from "@/lib/notification-categories";
import { publish } from "@/server/realtime/hub";
import { sendEmail } from "./email";
import { sendSms } from "./sms";

type Text = { en: string; fr: string };

/** The live channel of one person (bell counter, new messages). */
export const userRoom = (userId: string) => `user:${userId}`;

/** Tell a person's open pages that something changed (no content is sent, pages re-read it). */
export function ping(userId: string, kind: "notification" | "message", ref?: string) {
  publish(userRoom(userId), { type: kind, from: "server", payload: ref ? { ref } : undefined });
}

/** Does this person want this kind of notice by email/SMS too? (In-app is always on.) */
export async function wantsExternal(userId: string, type: string) {
  const category = categoryOf(type);
  if (ALWAYS_SENT.includes(category)) return true;
  const pref = await db.notificationPreference.findUnique({ where: { userId_type_channel: { userId, type: category, channel: "EMAIL" } } });
  return pref?.enabled ?? true;
}

/**
 * Store an in-app notification and send it by email (or SMS when there is no email),
 * unless the person turned that category off. A failed email or SMS never fails the action.
 */
export async function notify(userId: string, n: { type: string; title: Text; body: Text; link?: string; inApp?: boolean }) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.status === "DELETED") return;
  const l = user.locale;
  if (n.inApp !== false) {
    await db.notification.create({ data: { userId, type: n.type, title: n.title[l], body: n.body[l], link: n.link } });
    ping(userId, "notification");
  }
  if (!(await wantsExternal(userId, n.type))) return;

  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const link = n.link ? `${base}/${l}${n.link}` : undefined;
  const text = `${n.body[l]}${link ? `\n\n${link}` : ""}`;
  try {
    if (user.email) await sendEmail({ to: user.email, subject: `Learn Quick · ${n.title[l]}`, text });
    else if (user.phone) await sendSms(user.phone, `Learn Quick: ${n.title[l]}. ${link ?? ""}`.trim());
  } catch (e) {
    console.error("Notification delivery failed", e);
  }
}

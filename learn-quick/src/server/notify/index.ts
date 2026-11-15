import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "./email";
import { sendSms } from "./sms";

type Text = { en: string; fr: string };

/**
 * Store an in-app notification and send it by email (or SMS when there is no email).
 * A failed email or SMS never fails the action that triggered it.
 */
export async function notify(userId: string, n: { type: string; title: Text; body: Text; link?: string }) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const l = user.locale;
  await db.notification.create({ data: { userId, type: n.type, title: n.title[l], body: n.body[l], link: n.link } });

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const link = n.link ? `${base}/${l}${n.link}` : undefined;
  const text = `${n.body[l]}${link ? `\n\n${link}` : ""}`;
  try {
    if (user.email) await sendEmail({ to: user.email, subject: `Learn Quick · ${n.title[l]}`, text });
    else if (user.phone) await sendSms(user.phone, `Learn Quick: ${n.title[l]}. ${link ?? ""}`.trim());
  } catch (e) {
    console.error("Notification delivery failed", e);
  }
}

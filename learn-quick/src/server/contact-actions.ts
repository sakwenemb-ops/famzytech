"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { legalInfo } from "@/lib/legal";
import { TOPICS } from "@/lib/contact";
import { fieldErrors } from "@/lib/validation";
import { sendEmail } from "./notify/email";
import { clientIp, rateLimit } from "./rate-limit";
import { getCurrentUser } from "./session";



const schema = z.object({
  name: z.string().trim().min(2, "name_min").max(80),
  email: z.string().trim().toLowerCase().email("email_invalid").max(200),
  topic: z.enum(TOPICS),
  message: z.string().trim().min(10, "message_short").max(4000),
});

export type ContactState = { ok?: boolean; errors?: Record<string, string>; message?: string; values?: Record<string, string> } | undefined;

/** Sends the message to the support address. Limited to 5 messages per hour per network. */
export async function contactAction(_: ContactState, fd: FormData): Promise<ContactState> {
  const values = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  // Robots fill the hidden "website" field; people never see it
  if (values.website) return { ok: true };
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  if (!rateLimit(`contact:${clientIp(await headers())}`, 5, 3_600_000)) return { message: "too_many_attempts", values };

  const d = parsed.data;
  const user = await getCurrentUser();
  const l = legalInfo();
  const to = d.topic === "privacy" ? l.email : l.support;
  const account = user ? `Account: ${user.name} (${user.role}, id ${user.id}, ${user.email ?? user.phone ?? "no contact"})` : "Not signed in";
  try {
    await sendEmail({
      to,
      replyTo: d.email,
      subject: `[Contact · ${d.topic}] ${d.name}`,
      text: `From: ${d.name} <${d.email}>\n${account}\nTopic: ${d.topic}\n\n${d.message}`,
    });
  } catch (e) {
    console.error("Contact message failed", e);
    return { message: "send_failed", values };
  }
  return { ok: true };
}

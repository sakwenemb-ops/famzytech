"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { CATEGORIES, ALWAYS_SENT } from "@/lib/notification-categories";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "./session";

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  return user;
}

/** Only links inside the site are followed (a stored link can never send people elsewhere). */
const safeLink = (l: string | null) => (l && l.startsWith("/") && !l.startsWith("//") ? l : "/notifications");

export async function openNotificationAction(id: string) {
  const user = await me();
  const n = await db.notification.findFirst({ where: { id, userId: user.id } });
  if (!n) return;
  if (!n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  redirect({ href: safeLink(n.link), locale: await getLocale() });
}

export async function markAllReadAction() {
  const user = await me();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/[locale]/notifications", "page");
}

export async function savePreferencesAction(_: unknown, fd: FormData) {
  const user = await me();
  const choice = z.object(Object.fromEntries(CATEGORIES.map((c) => [c, z.literal("on").optional()]))).parse(Object.fromEntries(fd));
  await db.$transaction(
    CATEGORIES.filter((c) => !ALWAYS_SENT.includes(c)).map((c) =>
      db.notificationPreference.upsert({
        where: { userId_type_channel: { userId: user.id, type: c, channel: "EMAIL" } },
        create: { userId: user.id, type: c, channel: "EMAIL", enabled: choice[c] === "on" },
        update: { enabled: choice[c] === "on" },
      }),
    ),
  );
  return { ok: true as const };
}

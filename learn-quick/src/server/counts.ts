import "server-only";
import { db } from "@/lib/db";

/** Unread notifications and unread messages for the header badges. */
export async function unreadCounts(userId: string) {
  const [notifications, messages] = await Promise.all([
    db.notification.count({ where: { userId, readAt: null } }),
    db.message.count({
      where: { readAt: null, senderId: { not: userId }, conversation: { OR: [{ studentId: userId }, { teacherId: userId }] } },
    }),
  ]);
  return { notifications, messages };
}

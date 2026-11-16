import "server-only";
import { db } from "@/lib/db";

export const TOP_RATED = { minAvg: 4.8, minLessons: 20 };

/** Recompute a teacher's rating and the "Top rated" badge from their visible reviews. */
export async function refreshRating(teacherId: string) {
  const agg = await db.review.aggregate({ where: { teacherId, hidden: false }, _avg: { rating: true }, _count: true });
  const avg = Math.round((agg._avg.rating ?? 0) * 10) / 10;
  const t = await db.teacherProfile.update({ where: { id: teacherId }, data: { ratingAvg: avg, ratingCount: agg._count } });
  const deserves = avg >= TOP_RATED.minAvg && t.lessonsCompleted >= TOP_RATED.minLessons;
  if (deserves) await db.teacherBadge.upsert({ where: { teacherId_type: { teacherId, type: "TOP_RATED" } }, create: { teacherId, type: "TOP_RATED" }, update: {} });
  else await db.teacherBadge.deleteMany({ where: { teacherId, type: "TOP_RATED" } });
}

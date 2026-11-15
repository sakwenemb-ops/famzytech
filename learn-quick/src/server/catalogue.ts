import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { SPECIALTIES } from "@/lib/constants";
import { TIME_BUCKETS, matchesAvailability, type TimeBucket } from "@/lib/slots";

export const PAGE_SIZE = 12;
export const SORTS = ["relevance", "price_asc", "price_desc", "rating", "lessons"] as const;
export type Sort = (typeof SORTS)[number];

export type CatalogueFilters = {
  subject?: "ENGLISH" | "FRENCH";
  priceMin?: number;
  priceMax?: number;
  days: number[];
  buckets: TimeBucket[];
  specialty?: string;
  native: boolean;
  certified: boolean;
  country?: string;
  sort: Sort;
  page: number;
};

/** Read filters from the URL, ignoring anything invalid. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): CatalogueFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const many = (k: string) => (Array.isArray(sp[k]) ? sp[k] : sp[k] ? [sp[k] as string] : []);
  const int = (k: string) => (/^\d{1,6}$/.test(one(k)) ? Number(one(k)) : undefined);
  const subject = one("subject");
  return {
    subject: subject === "ENGLISH" || subject === "FRENCH" ? subject : undefined,
    priceMin: int("priceMin"),
    priceMax: int("priceMax"),
    days: many("day").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
    buckets: many("time").filter((b): b is TimeBucket => b in TIME_BUCKETS),
    specialty: (SPECIALTIES as readonly string[]).includes(one("specialty")) ? one("specialty") : undefined,
    native: one("native") === "1",
    certified: one("certified") === "1",
    country: /^[A-Z]{2}$/.test(one("country")) ? one("country") : undefined,
    sort: (SORTS as readonly string[]).includes(one("sort")) ? (one("sort") as Sort) : "relevance",
    page: Math.max(1, int("page") ?? 1),
  };
}

/** Rank teachers: rating weighted by how many reviews, experience, badges and a video. */
function relevance(t: { ratingAvg: number; ratingCount: number; lessonsCompleted: number; badges: unknown[]; videoUrl: string | null }) {
  return t.ratingAvg * Math.log10(t.ratingCount + 1) + Math.log10(t.lessonsCompleted + 1) + t.badges.length * 0.4 + (t.videoUrl ? 0.5 : 0);
}

export async function searchTeachers(f: CatalogueFilters, viewerTimeZone: string) {
  const where: Prisma.TeacherProfileWhereInput = {
    isPublished: true,
    hourlyRateXaf: { not: null, gte: f.priceMin, lte: f.priceMax },
    user: { status: "ACTIVE", country: f.country },
    subjects: f.subject ? { has: f.subject } : undefined,
    specialties: f.specialty ? { has: f.specialty } : undefined,
    nativeLanguages: f.native ? (f.subject ? { has: f.subject } : { isEmpty: false }) : undefined,
    badges: f.certified ? { some: { type: "CERTIFIED" } } : undefined,
  };
  // The time filter needs each teacher's weekly hours, so it is applied after the query.
  // Fine for hundreds of teachers; move to SQL if the catalogue grows to thousands.
  const rows = await db.teacherProfile.findMany({
    where,
    include: { user: { select: { name: true, country: true, timeZone: true } }, badges: true, availability: true },
  });
  const matching = rows.filter((t) =>
    matchesAvailability(t.availability, t.user.timeZone, viewerTimeZone, { days: f.days, buckets: f.buckets }),
  );

  const sorters: Record<Sort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
    relevance: (a, b) => relevance(b) - relevance(a),
    price_asc: (a, b) => (a.hourlyRateXaf ?? 0) - (b.hourlyRateXaf ?? 0),
    price_desc: (a, b) => (b.hourlyRateXaf ?? 0) - (a.hourlyRateXaf ?? 0),
    rating: (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount,
    lessons: (a, b) => b.lessonsCompleted - a.lessonsCompleted,
  };
  matching.sort((a, b) => sorters[f.sort](a, b) || a.id.localeCompare(b.id));

  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  return { total: matching.length, page, pages, teachers: matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/** Everything the public profile page shows. Unpublished profiles are returned too; the page decides who may see them. */
export const getTeacherProfile = cache(async (id: string) => {
  return db.teacherProfile.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, country: true, city: true, image: true, status: true } },
      badges: true,
      certificates: { where: { verified: true }, orderBy: { yearTo: "desc" } },
      educations: { where: { verified: true }, orderBy: { yearTo: "desc" } },
      reviews: {
        where: { hidden: false },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { student: { include: { user: { select: { name: true, country: true } } } } },
      },
    },
  });
});

export type TeacherProfileData = NonNullable<Awaited<ReturnType<typeof getTeacherProfile>>>;

/** Pick the text in the viewer's language, falling back to the other one. */
export function localized(locale: string, en?: string | null, fr?: string | null) {
  const primary = locale === "fr" ? fr : en;
  const fallback = locale === "fr" ? en : fr;
  if (primary?.trim()) return { text: primary, fallback: false };
  if (fallback?.trim()) return { text: fallback, fallback: true };
  return null;
}

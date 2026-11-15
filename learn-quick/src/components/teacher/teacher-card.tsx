import { getTranslations } from "next-intl/server";
import { BadgeCheck, Star } from "lucide-react";
import type { BadgeType } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { formatXaf } from "@/lib/utils";
import { LESSON_MINUTES } from "@/lib/constants";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export type CardTeacher = {
  id: string;
  photoUrl: string | null;
  headlineEn: string | null;
  headlineFr: string | null;
  subjects: string[];
  specialties: string[];
  hourlyRateXaf: number | null;
  trialRateXaf: number | null;
  ratingAvg: number;
  ratingCount: number;
  lessonsCompleted: number;
  user: { name: string };
  badges: { type: BadgeType }[];
};

export async function TeacherCard({ t, locale }: { t: CardTeacher; locale: "en" | "fr" }) {
  const tp = await getTranslations("teacherProfile");
  const tc = await getTranslations("catalogue");
  const to = await getTranslations("options");
  const headline = (locale === "fr" ? t.headlineFr || t.headlineEn : t.headlineEn || t.headlineFr) ?? "";

  return (
    <article className="relative flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-5 transition-shadow hover:shadow-[var(--shadow-card)] sm:flex-row">
      <Avatar name={t.user.name} src={t.photoUrl} size={88} />
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold">
          {/* The whole card is clickable through this link */}
          <Link href={`/teachers/${t.id}`} className="after:absolute after:inset-0 after:content-['']">
            {t.user.name}
          </Link>
        </h2>
        <p className="mt-0.5 line-clamp-2 text-[15px] text-muted">{headline}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="font-medium">{t.subjects.map((s) => to(`languages.${s}`)).join(", ")}</span>
          {t.ratingCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Star className="size-4 fill-accent text-accent" aria-hidden />
              <span className="font-medium">{t.ratingAvg.toFixed(1)}</span>
              <span className="text-muted">({tp("reviewsCount", { count: t.ratingCount })})</span>
            </span>
          ) : (
            <Badge tone="primary">{tp("newTeacher")}</Badge>
          )}
          <span className="text-muted">{tp("lessonsDone", { count: t.lessonsCompleted })}</span>
        </div>
        {t.badges.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {t.badges.map((b) => (
              <li key={b.type}>
                <Badge tone={b.type === "TOP_RATED" ? "warning" : "success"}>
                  <BadgeCheck className="size-3.5" aria-hidden />
                  {to(`badges.${b.type}`)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 items-end justify-between gap-3 border-t border-border pt-3 sm:w-36 sm:flex-col sm:items-end sm:justify-start sm:border-0 sm:pt-0 sm:text-right">
        <div>
          <p className="text-lg font-semibold tabular-nums">{formatXaf(t.hourlyRateXaf ?? 0, locale)}</p>
          <p className="text-xs text-muted">{tp("perLesson", { minutes: LESSON_MINUTES })}</p>
        </div>
        {t.trialRateXaf != null && (
          <p className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium">{tc("trialFrom", { price: formatXaf(t.trialRateXaf, locale) })}</p>
        )}
      </div>
    </article>
  );
}

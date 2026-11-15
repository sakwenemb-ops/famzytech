import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SlidersHorizontal } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { COUNTRIES } from "@/lib/countries";
import { SPECIALTIES } from "@/lib/constants";
import { TIME_BUCKETS } from "@/lib/slots";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/server/session";
import { SORTS, parseFilters, searchTeachers, type CatalogueFilters } from "@/server/catalogue";
import { TeacherCard } from "@/components/teacher/teacher-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Choice } from "@/components/ui/choice";
import { EmptyState } from "@/components/dashboard/shell";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalogue" });
  return { title: t("title"), alternates: { languages: { fr: "/fr/teachers", en: "/en/teachers" } } };
}

/** URL query for the current filters, with some values changed. */
function query(f: CatalogueFilters, patch: Partial<CatalogueFilters> = {}) {
  const v = { ...f, ...patch };
  const q: Record<string, string | string[]> = {};
  if (v.subject) q.subject = v.subject;
  if (v.priceMin != null) q.priceMin = String(v.priceMin);
  if (v.priceMax != null) q.priceMax = String(v.priceMax);
  if (v.days.length) q.day = v.days.map(String);
  if (v.buckets.length) q.time = v.buckets;
  if (v.specialty) q.specialty = v.specialty;
  if (v.native) q.native = "1";
  if (v.certified) q.certified = "1";
  if (v.country) q.country = v.country;
  if (v.sort !== "relevance") q.sort = v.sort;
  if (v.page > 1) q.page = String(v.page);
  return q;
}

export default async function TeachersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const f = parseFilters(await searchParams);
  const viewer = await getCurrentUser();
  const tz = viewer?.timeZone ?? "Africa/Douala";
  const res = await searchTeachers(f, tz);
  const t = await getTranslations("catalogue");
  const to = await getTranslations("options");
  const loc = locale as "en" | "fr";
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const activeCount = [f.priceMin, f.priceMax, f.specialty, f.country].filter((x) => x != null).length + f.days.length + f.buckets.length + Number(f.native) + Number(f.certified);

  const filters = (
    <form method="get" className="space-y-6">
      {f.subject && <input type="hidden" name="subject" value={f.subject} />}
      {f.sort !== "relevance" && <input type="hidden" name="sort" value={f.sort} />}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("price")}</legend>
        <div className="grid grid-cols-2 gap-2">
          <Input name="priceMin" inputMode="numeric" aria-label={t("priceMin")} placeholder={t("priceMin")} defaultValue={f.priceMin ?? ""} />
          <Input name="priceMax" inputMode="numeric" aria-label={t("priceMax")} placeholder={t("priceMax")} defaultValue={f.priceMax ?? ""} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">{t("when")}</legend>
        <p className="mb-2 text-xs text-muted">{t("timesHint", { tz: tz.replaceAll("_", " ") })}</p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <Choice key={d} variant="chip" name="day" value={d} defaultChecked={f.days.includes(d)} className="px-2.5 py-1 capitalize">
              {dayFmt.format(new Date(Date.UTC(2023, 0, 1 + d)))}
            </Choice>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(TIME_BUCKETS) as (keyof typeof TIME_BUCKETS)[]).map((b) => (
            <Choice key={b} variant="chip" name="time" value={b} defaultChecked={f.buckets.includes(b)} className="px-2.5 py-1">
              {t(`buckets.${b}`)}
            </Choice>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <label htmlFor="specialty" className="text-sm font-medium">{t("specialty")}</label>
        <Select id="specialty" name="specialty" defaultValue={f.specialty ?? ""}>
          <option value="">{t("any")}</option>
          {SPECIALTIES.map((s) => <option key={s} value={s}>{to(`specialties.${s}`)}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="country" className="text-sm font-medium">{t("country")}</label>
        <Select id="country" name="country" defaultValue={f.country ?? ""}>
          <option value="">{t("any")}</option>
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name[loc]}</option>)}
        </Select>
      </div>
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2.5"><input type="checkbox" name="native" value="1" defaultChecked={f.native} className="size-4 accent-[var(--color-primary)]" />{t("native")}</label>
        <label className="flex items-center gap-2.5"><input type="checkbox" name="certified" value="1" defaultChecked={f.certified} className="size-4 accent-[var(--color-primary)]" />{t("certified")}</label>
      </div>
      <div className="flex flex-col gap-2">
        <Button type="submit">{t("apply")}</Button>
        {activeCount > 0 && <Link href={{ pathname: "/teachers", query: query(f, { priceMin: undefined, priceMax: undefined, days: [], buckets: [], specialty: undefined, native: false, certified: false, country: undefined, page: 1 }) }} className={buttonVariants({ variant: "ghost" })}>{t("reset")}</Link>}
      </div>
    </form>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>

      {/* Language tabs */}
      <nav className="mt-5 flex flex-wrap gap-2" aria-label={t("learn")}>
        {([undefined, "ENGLISH", "FRENCH"] as const).map((s) => (
          <Link
            key={s ?? "all"}
            href={{ pathname: "/teachers", query: query(f, { subject: s, page: 1 }) }}
            aria-current={f.subject === s ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm",
              f.subject === s ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            {s ? to(`languages.${s}`) : t("any")}
          </Link>
        ))}
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside>
          <details className="group rounded-[var(--radius-lg)] border border-border bg-surface lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="size-4" aria-hidden />
              {t("filters")} {activeCount > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-fg">{activeCount}</span>}
            </summary>
            <div className="border-t border-border p-4">{filters}</div>
          </details>
          <div className="hidden lg:block">{filters}</div>
        </aside>

        <section aria-live="polite">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{t("subtitle", { count: res.total })}</p>
            <form method="get" className="flex items-center gap-2">
              {Object.entries(query(f, { sort: "relevance", page: 1 })).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => <input key={`${k}-${x}`} type="hidden" name={k} value={x} />))}
              <label htmlFor="sort" className="text-sm text-muted">{t("sort")}</label>
              <Select id="sort" name="sort" defaultValue={f.sort} className="h-9 w-auto text-sm">
                {SORTS.map((s) => <option key={s} value={s}>{t(`sorts.${s}`)}</option>)}
              </Select>
              <Button type="submit" size="sm" variant="secondary">OK</Button>
            </form>
          </div>

          {res.teachers.length === 0 ? (
            <EmptyState text={t("empty")} />
          ) : (
            <ul className="space-y-4">
              {res.teachers.map((teacher) => (
                <li key={teacher.id}><TeacherCard t={teacher} locale={loc} /></li>
              ))}
            </ul>
          )}

          {res.pages > 1 && (
            <nav className="mt-6 flex items-center justify-between text-sm" aria-label={t("page", { n: res.page, total: res.pages })}>
              {res.page > 1 ? <Link href={{ pathname: "/teachers", query: query(f, { page: res.page - 1 }) }} className={buttonVariants({ variant: "secondary", size: "sm" })}>{t("prev")}</Link> : <span />}
              <span className="text-muted">{t("page", { n: res.page, total: res.pages })}</span>
              {res.page < res.pages ? <Link href={{ pathname: "/teachers", query: query(f, { page: res.page + 1 }) }} className={buttonVariants({ variant: "secondary", size: "sm" })}>{t("next")}</Link> : <span />}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}

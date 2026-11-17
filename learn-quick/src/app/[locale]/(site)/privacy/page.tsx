import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { legalInfo, PRIVACY_UPDATED } from "@/lib/legal";
import { privacyPolicy } from "@/content/privacy";

// Company details come from the server settings, so read them on each request
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "fr" ? "Politique de confidentialité" : "Privacy policy" };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale === "fr" ? "fr" : "en";
  const policy = privacyPolicy(loc, legalInfo());
  const updated = new Intl.DateTimeFormat(loc, { dateStyle: "long", timeZone: "UTC" }).format(new Date(PRIVACY_UPDATED));

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:py-14">
      <h1 className="text-3xl font-semibold">{policy.title}</h1>
      <p className="mt-2 text-sm text-muted">{policy.updated} {updated}</p>
      <div className="mt-6 space-y-3 text-[15px] leading-relaxed">
        {policy.intro.map((p) => <p key={p}>{p}</p>)}
      </div>

      <nav aria-label={policy.title} className="mt-8 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
        <ol className="grid gap-1 text-sm sm:grid-cols-2">
          {policy.sections.map((s, i) => (
            <li key={s.h}><a href={`#s${i + 1}`} className="text-primary hover:underline">{s.h}</a></li>
          ))}
        </ol>
      </nav>

      {policy.sections.map((s, i) => (
        <section key={s.h} id={`s${i + 1}`} className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">{s.h}</h2>
          {s.table && (
            <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-border">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="bg-surface-2">
                  <tr>{s.table.head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {s.table.rows.map((r) => (
                    <tr key={r[0]} className="align-top">{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 space-y-3 text-[15px] leading-relaxed">
            {s.p?.map((p) => <p key={p}>{p}</p>)}
          </div>
          {s.list && (
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">
              {s.list.map((li) => <li key={li}>{li}</li>)}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}

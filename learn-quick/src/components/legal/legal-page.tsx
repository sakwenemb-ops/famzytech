import type { Policy } from "@/content/privacy";

/** Renders a long legal text (privacy policy, terms) with a table of contents. */
export function LegalPage({ policy, updatedIso, locale }: { policy: Policy; updatedIso: string; locale: "en" | "fr" }) {
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(updatedIso));
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
            <>
              {/* Phones: one card per row, easier to read than a wide table */}
              <div className="mt-4 space-y-3 sm:hidden">
                {s.table.rows.map((r) => (
                  <dl key={r[0]} className="rounded-[var(--radius-md)] border border-border bg-surface p-3 text-sm">
                    <dt className="font-medium">{r[0]}</dt>
                    {r.slice(1).map((c, j) => (
                      <dd key={j} className="mt-1.5">
                        <span className="block text-xs text-muted">{s.table!.head[j + 1]}</span>
                        {c}
                      </dd>
                    ))}
                  </dl>
                ))}
              </div>
              <div className="mt-4 hidden overflow-x-auto rounded-[var(--radius-md)] border border-border sm:block">
                <table className="w-full text-left text-sm">
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
            </>
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

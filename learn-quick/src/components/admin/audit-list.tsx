import { getFormatter, getTranslations } from "next-intl/server";
import type { AuditLog } from "@prisma/client";
import { EmptyState } from "@/components/dashboard/shell";

/** A readable list of audit entries (who did what, when). */
export async function AuditList({ entries, timeZone }: { entries: (AuditLog & { actor: { name: string } | null })[]; timeZone: string }) {
  const t = await getTranslations("audit");
  const format = await getFormatter();
  if (!entries.length) return <EmptyState text={t("none")} />;
  return (
    <ul className="divide-y divide-border text-sm">
      {entries.map((e) => (
        <li key={e.id} className="py-2.5" data-action={e.action}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{t.has(`actions.${e.action}`) ? t(`actions.${e.action}`) : e.action}</span>
            <span className="text-xs text-muted">{format.dateTime(e.createdAt, { dateStyle: "medium", timeStyle: "short", timeZone })}</span>
          </div>
          <p className="text-xs text-muted">
            {t("by", { name: e.actor?.name || t("system") })} · {e.targetType} {e.targetId.slice(0, 40)}
          </p>
          {e.meta != null && <p className="mt-0.5 break-all font-mono text-[11px] text-muted">{JSON.stringify(e.meta).slice(0, 300)}</p>}
        </li>
      ))}
    </ul>
  );
}

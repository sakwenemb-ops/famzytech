import { getTranslations } from "next-intl/server";
import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: LucideIcon; ready: boolean };

/** Sidebar on desktop, scrolling tab bar on mobile. Sections not built yet are shown but disabled. */
export async function DashboardShell({ nav, active, children }: { nav: NavItem[]; active: string; children: React.ReactNode }) {
  const t = await getTranslations("dashboard");
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:py-10">
      <nav aria-label="Dashboard" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:w-56 md:shrink-0 md:overflow-visible md:px-0">
        <ul className="flex gap-1 md:flex-col">
          {nav.map(({ href, label, icon: Icon, ready }) => {
            const isActive = href === active;
            const cls = cn(
              "flex items-center gap-2.5 whitespace-nowrap rounded-[var(--radius-md)] px-3 py-2 text-sm",
              isActive ? "bg-primary-soft font-medium text-primary" : "text-muted",
              ready && !isActive && "hover:bg-surface-2 hover:text-fg",
              !ready && "cursor-not-allowed opacity-60",
            );
            return (
              <li key={href}>
                {ready ? (
                  <Link href={href} className={cls} aria-current={isActive ? "page" : undefined}>
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {label}
                  </Link>
                ) : (
                  <span className={cls} title={t("soon")} aria-disabled>
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-8 text-center">
      <p className="text-sm text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

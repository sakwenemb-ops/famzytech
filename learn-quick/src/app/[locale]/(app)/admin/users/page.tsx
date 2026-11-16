import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/server/session";
import { DashboardShell, EmptyState, PageTitle } from "@/components/dashboard/shell";
import { adminNav } from "@/components/dashboard/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

const PAGE = 25;
const ROLES = ["STUDENT", "TEACHER", "ADMIN"] as const;
const STATUSES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;
const statusTone = { ACTIVE: "success", SUSPENDED: "danger", DELETED: "neutral" } as const;

export default async function AdminUsers({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const sp = await searchParams;
  const t = await getTranslations("adminUsers");
  const td = await getTranslations("dashboard");
  const tr = await getTranslations("roles");
  const format = await getFormatter();
  const q = (sp.q ?? "").trim().slice(0, 100);
  const role = ROLES.find((r) => r === sp.role);
  const status = STATUSES.find((s) => s === sp.status);
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.UserWhereInput = {
    ...(role && { role }),
    ...(status && { status }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\s/g, "") } }, { id: q }] }),
  };
  const [users, total] = await Promise.all([db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }), db.user.count({ where })]);
  const qs = (p: number) => `/admin/users?${new URLSearchParams({ ...(q && { q }), ...(role && { role }), ...(status && { status }), page: String(p) })}`;

  return (
    <DashboardShell nav={adminNav(td)} active="/admin/users">
      <PageTitle title={t("title")} subtitle={t("subtitle", { count: total })} />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
        <label className="sr-only" htmlFor="q">{t("search")}</label>
        <Input id="q" name="q" defaultValue={q} placeholder={t("searchPlaceholder")} />
        <label className="sr-only" htmlFor="role">{t("role")}</label>
        <Select id="role" name="role" defaultValue={role ?? ""}>
          <option value="">{t("allRoles")}</option>
          {ROLES.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
        </Select>
        <label className="sr-only" htmlFor="status">{t("status")}</label>
        <Select id="status" name="status" defaultValue={status ?? ""}>
          <option value="">{t("allStatuses")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`statuses.${s}`)}</option>)}
        </Select>
        <Button type="submit" variant="secondary">{t("search")}</Button>
      </form>
      {users.length === 0 ? (
        <EmptyState text={t("none")} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
          {users.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/users/${u.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface-2">
                <span className="min-w-0">
                  <span className="block font-medium">{u.name || "—"}</span>
                  <span className="block truncate text-xs text-muted">{[u.email, u.phone].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge>{tr(u.role)}</Badge>
                  <Badge tone={statusTone[u.status as keyof typeof statusTone] ?? "neutral"}>{t(`statuses.${u.status}`)}</Badge>
                  <span className="text-muted">{format.dateTime(u.createdAt, { dateStyle: "medium" })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > PAGE && (
        <nav className="mt-4 flex justify-between text-sm" aria-label={t("pages")}>
          {page > 1 ? <Link href={qs(page - 1)} className="text-primary">← {t("previous")}</Link> : <span />}
          {page * PAGE < total && <Link href={qs(page + 1)} className="text-primary">{t("next")} →</Link>}
        </nav>
      )}
    </DashboardShell>
  );
}

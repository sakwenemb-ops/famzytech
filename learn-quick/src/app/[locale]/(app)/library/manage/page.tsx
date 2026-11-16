import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ContentStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/session";
import { canManage } from "@/server/library/manage";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ImportForm } from "@/components/library/exercise-form";

const STATUSES: ContentStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

export default async function ManagePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);
  const user = await requireUser();
  const role = await canManage(user);
  if (!role) notFound();
  const t = await getTranslations("manage");
  const tl = await getTranslations("library");
  const filter = STATUSES.includes(status as ContentStatus) ? (status as ContentStatus) : undefined;
  const exercises = await db.exercise.findMany({
    where: { status: filter, ...(role === "teacher" ? { authorId: user.id } : {}) },
    orderBy: [{ status: "asc" }, { code: "asc" }, { createdAt: "desc" }],
    take: 300,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-muted">{t("subtitle")}</p>
        </div>
        <Link href="/library/manage/new" className={buttonVariants()}>{t("new")}</Link>
      </div>
      {role === "teacher" && <Alert tone="info">{t("teacherNote")}</Alert>}
      <nav className="flex flex-wrap gap-2" aria-label={t("title")}>
        {[undefined, ...STATUSES].map((s) => (
          <Link key={s ?? "all"} href={{ pathname: "/library/manage", query: s ? { status: s } : {} }} aria-current={filter === s ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm", filter === s ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:bg-surface-2")}>
            {s ? t(`status.${s}`) : t("filterAll")}
          </Link>
        ))}
      </nav>
      <Card>
        <CardBody className="p-0">
          {exercises.length === 0 ? <p className="p-5 text-sm text-muted">{t("empty")}</p> : (
            <ul className="divide-y divide-border">
              {exercises.map((e) => (
                <li key={e.id}>
                  <Link href={`/library/manage/${e.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-surface-2">
                    <span className="w-24 shrink-0 font-mono text-xs text-muted">{e.code ?? "—"}</span>
                    <span className="min-w-0 flex-1 truncate">{e.sourceText}</span>
                    <span className="hidden text-muted sm:inline">{e.level} · {tl(`directions.${e.direction}`)}</span>
                    <Badge tone={e.status === "PUBLISHED" ? "success" : e.status === "DRAFT" ? "warning" : "neutral"}>{t(`status.${e.status}`)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      {role === "admin" && (
        <Card>
          <CardHeader><CardTitle>{t("import")}</CardTitle></CardHeader>
          <CardBody><ImportForm /></CardBody>
        </Card>
      )}
    </div>
  );
}

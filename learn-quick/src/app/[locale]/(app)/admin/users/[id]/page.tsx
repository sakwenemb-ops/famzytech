import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { formatXaf } from "@/lib/utils";
import { requireRole } from "@/server/session";
import { balance } from "@/server/ledger";
import { DashboardShell, PageTitle, Stat } from "@/components/dashboard/shell";
import { adminNav } from "@/components/dashboard/nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { UserStatusForm } from "@/components/admin/user-status-form";
import { AuditList } from "@/components/admin/audit-list";
import { setReviewHiddenAction } from "@/server/admin-actions";
import { Button } from "@/components/ui/button";

const tone = { ACTIVE: "success", SUSPENDED: "danger", DELETED: "neutral" } as const;

export default async function AdminUser({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const admin = await requireRole("ADMIN");
  const user = await db.user.findUnique({ where: { id }, include: { teacherProfile: { include: { application: true } }, studentProfile: true } });
  if (!user) notFound();
  const t = await getTranslations("adminUsers");
  const td = await getTranslations("dashboard");
  const tr = await getTranslations("roles");
  const loc = locale as "en" | "fr";
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: admin.timeZone });

  const bookingWhere = user.teacherProfile ? { teacherId: user.teacherProfile.id } : user.studentProfile ? { studentId: user.studentProfile.id } : null;
  const reviews = user.teacherProfile ? await db.review.findMany({ where: { teacherId: user.teacherProfile.id }, orderBy: { createdAt: "desc" }, take: 30, include: { student: { include: { user: { select: { name: true } } } } } }) : [];
  const [wallet, pending, available, lessons, upcoming, payments, audit] = await Promise.all([
    balance({ type: "STUDENT_WALLET", userId: id }),
    balance({ type: "TEACHER_PENDING", userId: id }),
    balance({ type: "TEACHER_AVAILABLE", userId: id }),
    bookingWhere ? db.booking.count({ where: { ...bookingWhere, status: "COMPLETED" } }) : 0,
    bookingWhere ? db.booking.count({ where: { ...bookingWhere, status: "CONFIRMED", startsAt: { gt: new Date() } } }) : 0,
    db.payment.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.auditLog.findMany({ where: { OR: [{ targetId: id }, { actorId: id }] }, orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { name: true } } } }),
  ]);

  return (
    <DashboardShell nav={adminNav(td)} active="/admin/users">
      <Link href="/admin/users" className="mb-3 inline-block text-sm text-primary hover:underline">← {t("back")}</Link>
      <PageTitle title={user.name || "—"} subtitle={[user.email, user.phone].filter(Boolean).join(" · ")} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Badge>{tr(user.role)}</Badge>
        <Badge tone={tone[user.status as keyof typeof tone] ?? "neutral"} data-testid="user-status">{t(`statuses.${user.status}`)}</Badge>
        {user.emailVerified || user.phoneVerified ? <Badge tone="success">{t("verified")}</Badge> : <Badge tone="warning">{t("notVerified")}</Badge>}
        {user.teacherProfile && <Badge tone={user.teacherProfile.isPublished ? "success" : "neutral"}>{t(user.teacherProfile.isPublished ? "published" : "hidden")}</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t("lessonsDone")} value={lessons} />
        <Stat label={t("upcoming")} value={upcoming} />
        {user.role === "TEACHER" ? (
          <>
            <Stat label={t("pending")} value={formatXaf(pending, loc)} />
            <Stat label={t("available")} value={formatXaf(available, loc)} />
          </>
        ) : (
          <Stat label={t("wallet")} value={formatXaf(wallet, loc)} />
        )}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("details")}</CardTitle></CardHeader>
          <CardBody>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">{t("joined")}</dt><dd>{fmt.format(user.createdAt)}</dd>
              <dt className="text-muted">{t("country")}</dt><dd>{user.country}{user.city ? `, ${user.city}` : ""}</dd>
              <dt className="text-muted">{t("language")}</dt><dd>{user.locale.toUpperCase()}</dd>
              {user.teacherProfile && (
                <>
                  <dt className="text-muted">{t("application")}</dt>
                  <dd>{user.teacherProfile.application ? <Link className="text-primary hover:underline" href={`/admin/applications/${user.teacherProfile.application.id}`}>{user.teacherProfile.application.status}</Link> : "—"}</dd>
                  <dt className="text-muted">{t("profile")}</dt>
                  <dd><Link className="text-primary hover:underline" href={`/teachers/${user.teacherProfile.id}`}>{t("viewProfile")}</Link></dd>
                </>
              )}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("access")}</CardTitle></CardHeader>
          <CardBody>
            {user.role === "ADMIN" || user.id === admin.id || user.status === "DELETED" ? (
              <p className="text-sm text-muted">{t("cannotChange")}</p>
            ) : (
              <UserStatusForm userId={user.id} status={user.status as "ACTIVE" | "SUSPENDED"} upcoming={upcoming} />
            )}
          </CardBody>
        </Card>
      </div>
      {payments.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle>{t("payments")}</CardTitle></CardHeader>
          <CardBody>
            <ul className="divide-y divide-border text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{fmt.format(p.createdAt)} · {p.provider}</span>
                  <span className="tabular-nums">{formatXaf(p.amountXaf, loc)} · {p.status}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
      {reviews.length > 0 && (
        <Card className="mt-4">
          <CardHeader><CardTitle>{t("reviews")}</CardTitle></CardHeader>
          <CardBody>
            <ul className="divide-y divide-border text-sm">
              {reviews.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5" data-review={r.hidden ? "hidden" : "shown"}>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span> · {r.student.user.name}
                    {r.comment && <span className="block text-muted">{r.comment}</span>}
                  </span>
                  <form action={setReviewHiddenAction.bind(null, r.id, !r.hidden)}>
                    <Button size="sm" variant="secondary">{t(r.hidden ? "showReview" : "hideReview")}</Button>
                  </form>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
      <Card className="mt-4">
        <CardHeader><CardTitle>{t("history")}</CardTitle></CardHeader>
        <CardBody><AuditList entries={audit} timeZone={admin.timeZone} /></CardBody>
      </Card>
    </DashboardShell>
  );
}

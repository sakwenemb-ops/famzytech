import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { formatXaf } from "@/lib/utils";
import { requireRole } from "@/server/session";
import { earnedFor } from "@/server/disputes";
import { DashboardShell, PageTitle } from "@/components/dashboard/shell";
import { adminNav } from "@/components/dashboard/nav";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { ResolveDisputeForm } from "@/components/booking/dispute-forms";

export default async function AdminDispute({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const admin = await requireRole("ADMIN");
  const d = await db.dispute.findUnique({
    where: { id },
    include: { booking: { include: { student: { include: { user: true } }, teacher: { include: { user: true } }, lesson: { include: { attendance: true, _count: { select: { chat: true } } } } } } },
  });
  if (!d) notFound();
  const t = await getTranslations("disputes");
  const td = await getTranslations("dashboard");
  const tl = await getTranslations("lessons");
  const loc = locale as "en" | "fr";
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: admin.timeZone });
  const b = d.booking;
  const earned = await earnedFor(b.id);
  const who = (userId: string) => (userId === b.student.userId ? b.student.user.name : userId === b.teacher.userId ? b.teacher.user.name : userId);
  const pct = (p: number) => formatXaf(earned ? Math.round((earned.net * p) / 100) + Math.round((earned.fee * p) / 100) : 0, loc);

  return (
    <DashboardShell nav={adminNav(td)} active="/admin/disputes">
      <Link href="/admin/disputes" className="mb-3 inline-block text-sm text-primary hover:underline">← {t("adminTitle")}</Link>
      <PageTitle title={t("detailTitle", { student: b.student.user.name, teacher: b.teacher.user.name })} subtitle={fmt.format(b.startsAt)} />
      <p className="mb-4">
        <Badge tone={d.status === "OPEN" ? "warning" : "success"} data-testid="dispute-status">
          {t(`status.${d.status}`)}{d.refundPct ? ` (${d.refundPct} %)` : ""}
        </Badge>
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("whatWasSaid")}</CardTitle></CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div><p className="font-medium">{t("studentSaid")}</p><p className="whitespace-pre-wrap text-muted">{d.reason}</p></div>
            <div><p className="font-medium">{t("teacherSaid")}</p><p className="whitespace-pre-wrap text-muted">{d.teacherResponse ?? t("noResponse")}</p></div>
            {d.resolution && <div><p className="font-medium">{t("decisionNote")}</p><p className="text-muted">{d.resolution}</p></div>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("facts")}</CardTitle></CardHeader>
          <CardBody>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">{t("lessonStatus")}</dt><dd><Badge>{tl(`status.${b.status}`)}</Badge></dd>
              <dt className="text-muted">{t("price")}</dt><dd>{formatXaf(b.priceXaf, loc)}{b.packageId ? ` (${t("pack")})` : ""}</dd>
              <dt className="text-muted">{t("teacherShare")}</dt><dd>{earned ? formatXaf(earned.net, loc) : "—"}</dd>
              <dt className="text-muted">{t("attendance")}</dt>
              <dd>
                {b.lesson?.attendance.length ? (
                  <ul>
                    {b.lesson.attendance.map((a) => (
                      <li key={a.id}>{who(a.userId)} : {fmt.format(a.joinedAt)} → {a.leftAt ? fmt.format(a.leftAt) : "?"}</li>
                    ))}
                  </ul>
                ) : t("nobodyJoined")}
              </dd>
              <dt className="text-muted">{t("chat")}</dt><dd>{b.lesson?._count.chat ?? 0}</dd>
            </dl>
            {b.lesson && <Link href={`/lesson/${b.id}`} className="mt-3 inline-block text-sm text-primary hover:underline">{t("openRecord")}</Link>}
          </CardBody>
        </Card>
      </div>
      {d.status === "OPEN" && (
        <Card className="mt-4">
          <CardHeader><CardTitle>{t("decide")}</CardTitle></CardHeader>
          <CardBody>
            {earned ? <ResolveDisputeForm disputeId={d.id} amounts={{ 0: pct(0), 50: pct(50), 100: pct(100) }} /> : <p className="text-sm text-muted">{t("notFunded")}</p>}
          </CardBody>
        </Card>
      )}
    </DashboardShell>
  );
}

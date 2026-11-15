import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { formatXaf } from "@/lib/utils";
import { requireRole } from "@/server/session";
import { balance } from "@/server/ledger";
import { getSetting } from "@/server/settings";
import { DashboardShell, PageTitle } from "@/components/dashboard/shell";
import { teacherNav } from "@/components/dashboard/nav";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyHistory, PayoutList } from "@/components/money/money-lists";
import { PayoutForm } from "@/components/money/payout-form";

export default async function EarningsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");
  const t = await getTranslations("earnings");
  const tm = await getTranslations("money");
  const td = await getTranslations("dashboard");
  const [pending, available, pct, hours, min, teacher] = await Promise.all([
    balance({ type: "TEACHER_PENDING", userId: user.id }),
    balance({ type: "TEACHER_AVAILABLE", userId: user.id }),
    getSetting("commissionPct"),
    getSetting("escrowReleaseHours"),
    getSetting("minPayoutXaf"),
    db.teacherProfile.findUnique({ where: { userId: user.id }, select: { payoutPhone: true } }),
  ]);
  const loc = user.locale;
  return (
    <DashboardShell nav={teacherNav(td)} active="/teacher/earnings">
      <PageTitle title={t("title")} subtitle={t("subtitle", { pct })} />
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
            <p className="text-sm text-muted">{t("pending")}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatXaf(pending, loc)}</p>
            <p className="mt-1 text-xs text-muted">{t("pendingHint", { hours })}</p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-success/30 bg-success-soft p-5">
            <p className="text-sm text-success">{t("available")}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{formatXaf(available, loc)}</p>
            <p className="mt-1 text-xs text-muted">{t("availableHint", { min: formatXaf(min, loc) })}</p>
          </div>
        </div>
        <Card>
          <CardHeader><CardTitle>{tm("withdraw")}</CardTitle></CardHeader>
          <CardBody>
            <PayoutForm
              max={available}
              defaultPhone={teacher?.payoutPhone ?? user.phone}
              minHint={t("availableHint", { min: formatXaf(min, loc) })}
              emptyText={available >= min ? undefined : t("noWithdraw")}
            />
          </CardBody>
        </Card>
        <PayoutList user={user} />
        <MoneyHistory user={user} types={["TEACHER_PENDING", "TEACHER_AVAILABLE"]} />
      </div>
    </DashboardShell>
  );
}

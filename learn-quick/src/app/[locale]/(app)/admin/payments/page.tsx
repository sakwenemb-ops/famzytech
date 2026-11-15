import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { formatXaf } from "@/lib/utils";
import { requireRole } from "@/server/session";
import { ESCROW, IN_FLIGHT, REVENUE, balance, verifyLedger } from "@/server/ledger";
import { paymentProvider } from "@/server/payments";
import { DashboardShell, PageTitle, Stat } from "@/components/dashboard/shell";
import { adminNav } from "@/components/dashboard/nav";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PayoutReview } from "@/components/money/payout-review";

const tone = { SUCCESSFUL: "success", PENDING: "warning", FAILED: "danger", EXPIRED: "neutral", REFUNDED: "neutral" } as const;

export default async function AdminPaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await requireRole("ADMIN");
  const t = await getTranslations("adminPay");
  const tm = await getTranslations("money");
  const td = await getTranslations("dashboard");
  const tr = await getTranslations("roles");
  const loc = locale as "en" | "fr";
  const [escrow, revenue, inFlight, health, toApprove, recent] = await Promise.all([
    balance(ESCROW),
    balance(REVENUE),
    balance(IN_FLIGHT),
    verifyLedger(),
    db.payout.findMany({ where: { status: "REQUESTED" }, orderBy: { createdAt: "asc" }, include: { teacher: { include: { user: { select: { name: true } } } } } }),
    db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { user: { select: { name: true } } } }),
  ]);
  const users = await db.user.findMany({ where: { id: { in: toApprove.map((p) => p.userId) } }, select: { id: true, name: true, role: true } });
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: admin.timeZone });
  const provider = paymentProvider().name;

  return (
    <DashboardShell nav={adminNav(td)} active="/admin/payments">
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-4">
        {provider === "sandbox" && <Alert tone="warning">{t("sandboxWarning")}</Alert>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label={t("escrow")} value={formatXaf(escrow, loc)} />
          <Stat label={t("revenue")} value={formatXaf(revenue, loc)} />
          <Stat label={t("inFlight")} value={formatXaf(inFlight, loc)} />
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={health.sumIsZero && !health.mismatched.length ? "success" : "danger"}>
            {health.sumIsZero && !health.mismatched.length ? t("ledgerOk") : t("ledgerBad")}
          </Badge>
          <span className="text-muted">{t("provider", { name: provider === "campay" ? "Campay" : "Sandbox" })}</span>
        </p>

        <Card>
          <CardHeader><CardTitle>{t("toApprove")}</CardTitle></CardHeader>
          <CardBody>
            {toApprove.length === 0 ? (
              <p className="text-sm text-muted">{t("noneToApprove")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {toApprove.map((p) => {
                  const u = users.find((x) => x.id === p.userId);
                  return (
                    <li key={p.id} data-payout={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-medium">{u?.name} · <span className="tabular-nums">{formatXaf(p.amountXaf, loc)}</span></p>
                        <p className="text-muted">{p.phone} · {fmt.format(p.createdAt)} · {u ? tr(u.role) : ""}</p>
                      </div>
                      <PayoutReview id={p.id} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("recent")}</CardTitle></CardHeader>
          <CardBody className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-border">
                {recent.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 text-muted">{fmt.format(p.createdAt)}</td>
                    <td className="py-2 pr-3">{p.user.name}</td>
                    <td className="py-2 pr-3 text-muted">{p.provider === "WALLET" ? tm("kinds.WALLET_PAYMENT") : `${p.operator ?? ""} ${p.phone ?? ""}`}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatXaf(p.amountXaf, loc)}</td>
                    <td className="py-2"><Badge tone={tone[p.status]}>{tm(`paymentStatus.${p.status}`)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </DashboardShell>
  );
}

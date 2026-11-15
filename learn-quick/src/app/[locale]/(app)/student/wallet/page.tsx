import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatXaf } from "@/lib/utils";
import { requireRole } from "@/server/session";
import { balance } from "@/server/ledger";
import { DashboardShell, PageTitle, Stat } from "@/components/dashboard/shell";
import { studentNav } from "@/components/dashboard/nav";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyHistory, PaymentList, PayoutList } from "@/components/money/money-lists";
import { PayoutForm } from "@/components/money/payout-form";

export default async function WalletPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");
  const t = await getTranslations("wallet");
  const tm = await getTranslations("money");
  const td = await getTranslations("dashboard");
  const te = await getTranslations("earnings");
  const amount = await balance({ type: "STUDENT_WALLET", userId: user.id });
  return (
    <DashboardShell nav={studentNav(td)} active="/student/wallet">
      <PageTitle title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-4">
        <Stat label={t("balance")} value={formatXaf(amount, user.locale)} />
        <Card>
          <CardHeader>
            <CardTitle>{tm("withdraw")}</CardTitle>
            {amount > 0 && <p className="mt-1 text-sm text-muted">{t("useForLesson")}</p>}
          </CardHeader>
          <CardBody>
            <PayoutForm max={amount} defaultPhone={user.phone} emptyText={amount > 0 ? undefined : te("noWithdraw")} />
          </CardBody>
        </Card>
        <PayoutList user={user} />
        <PaymentList user={user} />
        <MoneyHistory user={user} types={["STUDENT_WALLET"]} />
      </div>
    </DashboardShell>
  );
}

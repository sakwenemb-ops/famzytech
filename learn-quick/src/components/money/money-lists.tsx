import { getTranslations } from "next-intl/server";
import type { LedgerAccountType, User } from "@prisma/client";
import { db } from "@/lib/db";
import { formatXaf } from "@/lib/utils";
import { history } from "@/server/ledger";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

const payoutTone = { PAID: "success", FAILED: "danger", REJECTED: "danger", REQUESTED: "warning", APPROVED: "primary", PROCESSING: "primary" } as const;

/** Ledger history of one personal account. */
export async function MoneyHistory({ user, types }: { user: User; types: LedgerAccountType[] }) {
  const t = await getTranslations("money");
  const loc = user.locale;
  const rows = (await Promise.all(types.map((type) => history({ type, userId: user.id })))).flat()
    // Moving earnings from "pending" to "available" is one event: show only the arriving half
    .filter((r) => !(r.transaction.kind === "EARNINGS_RELEASED" && r.amountXaf < 0))
    .sort((a, b) => b.transaction.createdAt.getTime() - a.transaction.createdAt.getTime());
  const fmt = new Intl.DateTimeFormat(loc, { dateStyle: "medium", timeStyle: "short", timeZone: user.timeZone });
  return (
    <Card>
      <CardHeader><CardTitle>{t("history")}</CardTitle></CardHeader>
      <CardBody>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{t("noHistory")}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p>{t.has(`kinds.${r.transaction.kind}`) ? t(`kinds.${r.transaction.kind}`) : r.transaction.kind}</p>
                  <p className="text-xs text-muted">{fmt.format(r.transaction.createdAt)}</p>
                </div>
                <span className={`font-medium tabular-nums ${r.amountXaf > 0 ? "text-success" : ""}`}>
                  {r.amountXaf > 0 ? "+" : "−"}{formatXaf(Math.abs(r.amountXaf), loc)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export async function PayoutList({ user }: { user: User }) {
  const t = await getTranslations("money");
  const payouts = await db.payout.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 });
  if (!payouts.length) return null;
  const fmt = new Intl.DateTimeFormat(user.locale, { dateStyle: "medium", timeZone: user.timeZone });
  return (
    <Card>
      <CardHeader><CardTitle>{t("payouts")}</CardTitle></CardHeader>
      <CardBody>
        <ul className="divide-y divide-border text-sm">
          {payouts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span>{fmt.format(p.createdAt)} · {p.phone}</span>
              <span className="flex items-center gap-2">
                <span className="font-medium tabular-nums">{formatXaf(p.amountXaf, user.locale)}</span>
                <Badge tone={payoutTone[p.status]}>{t(`payoutStatus.${p.status}`)}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export async function PaymentList({ user }: { user: User }) {
  const t = await getTranslations("money");
  const payments = await db.payment.findMany({ where: { userId: user.id, status: { in: ["SUCCESSFUL", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 20 });
  if (!payments.length) return null;
  const fmt = new Intl.DateTimeFormat(user.locale, { dateStyle: "medium", timeZone: user.timeZone });
  return (
    <Card>
      <CardHeader><CardTitle>{t("receipts")}</CardTitle></CardHeader>
      <CardBody>
        <ul className="divide-y divide-border text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <span>{fmt.format(p.confirmedAt ?? p.createdAt)} · <span className="tabular-nums">{formatXaf(p.amountXaf, user.locale)}</span></span>
              <a href={`/${user.locale}/receipts/${p.id}`} className="text-primary hover:underline">{t("receipt")}</a>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

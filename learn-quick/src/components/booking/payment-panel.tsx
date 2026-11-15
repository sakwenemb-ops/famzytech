"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Smartphone, Wallet } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { paymentStatusAction, payWithWalletAction, sandboxDecideAction, startPaymentAction } from "@/server/payment-actions";
import { cameroonOperator, normalizePhone } from "@/lib/phone";
import { formatXaf } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type Waiting = { paymentId: string; ussdCode?: string | null; operator?: string | null };

/**
 * Mobile Money checkout: enter the number → approve on the phone → confirmed.
 * The page asks the server every 3 seconds; the server asks Campay for the real status.
 */
export function PaymentPanel({
  bookingId,
  amountXaf,
  defaultPhone,
  walletBalance,
  sandbox,
}: {
  bookingId: string;
  amountXaf: number;
  defaultPhone: string | null;
  walletBalance: number;
  sandbox: boolean;
}) {
  const t = useTranslations("pay");
  const locale = useLocale() as "en" | "fr";
  const router = useRouter();
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const normalized = normalizePhone(phone);
  const op = normalized ? cameroonOperator(normalized) : null;
  const done = (bookingId: string) => router.push(`/student/lessons?booked=${bookingId}`);

  // Poll while waiting for approval
  useEffect(() => {
    if (!waiting) return;
    const check = async () => {
      const res = await paymentStatusAction(waiting.paymentId);
      if (res.status === "SUCCESSFUL" && res.bookingConfirmed) done(res.bookingId!);
      else if (res.status === "SUCCESSFUL") router.push("/student/wallet"); // paid, but the time was taken: money is in the wallet
      else if (res.status === "FAILED" || res.status === "EXPIRED") {
        setWaiting(null);
        setError(res.status === "FAILED" ? "declined" : "timeout");
      }
    };
    timer.current = setInterval(check, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when the payment changes
  }, [waiting?.paymentId]);

  const pay = () =>
    start(async () => {
      setError(null);
      const res = await startPaymentAction(bookingId, phone);
      if ("error" in res) setError(res.error);
      else setWaiting({ paymentId: res.paymentId, ussdCode: res.ussdCode, operator: res.operator });
    });

  if (waiting) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-primary/30 bg-primary-soft p-4">
          <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">{t("approveTitle")}</p>
            <p className="mt-1">{t("approveBody", { amount: formatXaf(amountXaf, locale) })}</p>
            {waiting.ussdCode && <p className="mt-2 text-muted">{t("ussd", { code: waiting.ussdCode })}</p>}
          </div>
        </div>
        {sandbox && (
          <div className="space-y-2 rounded-[var(--radius-md)] border border-dashed border-warning p-4">
            <p className="text-xs text-muted">{t("sandboxNote")}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => sandboxDecideAction(waiting.paymentId, "approve")}>{t("sandboxApprove")}</Button>
              <Button size="sm" variant="secondary" onClick={() => sandboxDecideAction(waiting.paymentId, "decline")}>{t("sandboxDecline")}</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="danger">{t(`errors.${error}`)}</Alert>}
      {walletBalance >= amountXaf && (
        <>
          <Button
            block
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await payWithWalletAction(bookingId);
                if ("error" in res) setError(res.error);
                else done(bookingId);
              })
            }
          >
            <Wallet className="size-4" aria-hidden />
            {t("payWallet", { balance: formatXaf(walletBalance, locale) })}
          </Button>
          <p className="text-center text-xs text-muted">{t("or")}</p>
        </>
      )}
      <Field id="momo" label={t("phone")} hint={t("phoneHint")}>
        {(a) => (
          <div className="relative">
            <Input {...a} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6XX XX XX XX" className="pr-28" />
            {op === "MTN" && <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-mtn px-2.5 py-0.5 text-xs font-semibold text-black">MTN MoMo</span>}
            {op === "ORANGE" && <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-orange px-2.5 py-0.5 text-xs font-semibold text-black">Orange Money</span>}
          </div>
        )}
      </Field>
      {normalized && op !== "MTN" && op !== "ORANGE" && <p className="text-[13px] text-danger">{t("errors.operator_unsupported")}</p>}
      <Button block size="lg" disabled={pending || !normalized || (op !== "MTN" && op !== "ORANGE")} onClick={pay}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Smartphone className="size-4" aria-hidden />}
        {t("payButton", { amount: formatXaf(amountXaf, locale) })}
      </Button>
      <p className="text-center text-xs text-muted">{t("secure")}</p>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { approvePayoutAction, rejectPayoutAction } from "@/server/payment-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PayoutReview({ id }: { id: string }) {
  const t = useTranslations("adminPay");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      {rejecting ? (
        <>
          <Input aria-label={t("rejectReason")} placeholder={t("rejectReason")} value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 w-64" />
          <Button size="sm" variant="danger" disabled={pending || !reason.trim()} onClick={() => start(async () => { await rejectPayoutAction(id, reason); router.refresh(); })}>{t("reject")}</Button>
        </>
      ) : (
        <>
          <Button size="sm" disabled={pending} onClick={() => start(async () => { await approvePayoutAction(id); router.refresh(); })}>{t("approve")}</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setRejecting(true)}>{t("reject")}</Button>
        </>
      )}
    </div>
  );
}

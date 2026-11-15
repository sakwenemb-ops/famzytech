import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { formatXaf } from "@/lib/utils";
import { requireUser } from "@/server/session";
import { PrintButton } from "@/components/money/print-button";

/** A printable receipt (the browser's "Save as PDF" makes the PDF). */
export default async function ReceiptPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser();
  const p = await db.payment.findUnique({ where: { id }, include: { user: true } });
  if (!p || p.status !== "SUCCESSFUL" || (p.userId !== user.id && user.role !== "ADMIN")) notFound();
  const booking = p.bookingId ? await db.booking.findUnique({ where: { id: p.bookingId }, include: { teacher: { include: { user: { select: { name: true } } } } } }) : null;

  const t = await getTranslations("receipt");
  const loc = locale as "en" | "fr";
  const tz = p.user.timeZone;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short", timeZone: tz });
  const payload = (p.providerPayload ?? {}) as { operatorRef?: string };
  const what = booking
    ? booking.packageSize
      ? t("packWith", { size: booking.packageSize, name: booking.teacher.user.name })
      : t("lessonWith", { name: booking.teacher.user.name, date: date.format(booking.startsAt) })
    : "—";

  return (
    <div className="mx-auto max-w-xl px-4 py-10 print:py-0">
      <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 print:border-0 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">Learn Quick</p>
            <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
          </div>
          <p className="text-right text-sm text-muted">{t("number")}<br /><span className="font-mono text-fg">{p.id.slice(-10).toUpperCase()}</span></p>
        </div>
        <dl className="mt-6 divide-y divide-border text-sm">
          {[
            [t("date"), date.format(p.confirmedAt ?? p.createdAt)],
            [t("paidBy"), p.user.name],
            [t("method"), p.provider === "WALLET" ? t("wallet") : `${p.operator === "ORANGE" ? "Orange Money" : "MTN Mobile Money"} · ${p.phone ?? ""}`],
            [t("for"), what],
            ...(payload.operatorRef ? [[t("operatorRef"), payload.operatorRef]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 py-2.5"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
          ))}
          <div className="flex justify-between gap-6 py-3 text-base font-semibold"><dt>{t("amount")}</dt><dd className="tabular-nums">{formatXaf(p.amountXaf, loc)}</dd></div>
        </dl>
        <p className="mt-6 text-xs text-muted">{t("footer")}</p>
      </div>
      <div className="mt-4 print:hidden"><PrintButton label={t("print")} /></div>
    </div>
  );
}

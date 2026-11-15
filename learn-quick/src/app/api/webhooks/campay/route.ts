import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCampaySignature } from "@/server/payments/campay";
import { refreshPayment } from "@/server/payments/service";
import { checkPayouts } from "@/server/payments/payouts";

export const runtime = "nodejs";

/**
 * Campay calls this URL when a payment or withdrawal changes status. Campay's docs don't
 * say for sure whether it uses GET (query parameters) or POST (JSON or form), so all are accepted.
 *
 * Safety: the webhook's own fields are NEVER trusted. It only tells us which transaction to
 * re-check; the real status and amount are fetched from Campay's API with our own credentials.
 */
async function handle(req: Request) {
  const url = new URL(req.url);
  const params: Record<string, string> = Object.fromEntries(url.searchParams);
  if (req.method === "POST") {
    const type = req.headers.get("content-type") ?? "";
    try {
      if (type.includes("application/json")) Object.assign(params, await req.json());
      else if (type.includes("form")) Object.assign(params, Object.fromEntries((await req.formData()).entries()));
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
  }
  const reference = String(params.reference ?? "");
  if (!reference || reference.length > 100) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const key = process.env.CAMPAY_WEBHOOK_KEY;
  const signatureOk = key ? verifyCampaySignature(String(params.signature ?? ""), key) : false;
  if (key && !signatureOk) return NextResponse.json({ error: "bad_signature" }, { status: 401 });

  const payment = await db.payment.findUnique({ where: { providerRef: reference } });
  const eventId = `${reference}:${String(params.status ?? "").slice(0, 20)}`;
  await db.webhookEvent
    .create({ data: { provider: "AGGREGATOR", eventId, paymentId: payment?.id, signatureOk, payload: params } })
    .catch(() => undefined); // the same event delivered twice is fine

  if (payment) await refreshPayment(payment.id, { force: true });
  else if (await db.payout.findUnique({ where: { providerRef: reference } })) await checkPayouts();

  await db.webhookEvent.updateMany({ where: { provider: "AGGREGATOR", eventId }, data: { processedAt: new Date() } });
  return NextResponse.json({ ok: true });
}

export const GET = handle;
export const POST = handle;

import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { PaymentProvider, ProviderTransaction } from "./types";

/**
 * A pretend Mobile Money provider for development and automated tests. No real money moves.
 * The checkout page shows "approve" / "decline" buttons that play the payer's role.
 * The pretend status lives in the database (Payment / Payout `providerPayload.sandbox`).
 */
export class SandboxProvider implements PaymentProvider {
  readonly name = "sandbox" as const;

  async requestPayment() {
    return { providerRef: `sbx_${randomUUID()}`, ussdCode: "*126#" };
  }

  async getStatus(providerRef: string): Promise<ProviderTransaction> {
    const payment = await db.payment.findUnique({ where: { providerRef } });
    const payout = payment ? null : await db.payout.findUnique({ where: { providerRef } });
    const row = payment ?? payout;
    const state = ((row as { providerPayload?: unknown } | null)?.providerPayload as { sandbox?: string } | null)?.sandbox;
    return {
      status: state === "SUCCESSFUL" || state === "FAILED" ? state : "PENDING",
      amountXaf: row?.amountXaf ?? null,
      currency: "XAF",
      operator: "MTN",
      operatorRef: state === "SUCCESSFUL" ? `SBX${Date.now()}` : null,
    };
  }

  async disburse() {
    // Sandbox payouts succeed at once
    return { providerRef: `sbx_${randomUUID()}`, status: "SUCCESSFUL" as const };
  }
}

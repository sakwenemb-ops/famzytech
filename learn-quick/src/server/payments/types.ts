/** What every payment provider must do. Swap Campay for direct MTN/Orange APIs later without touching booking code. */
export type ProviderStatus = "PENDING" | "SUCCESSFUL" | "FAILED";

export type ProviderTransaction = {
  status: ProviderStatus;
  amountXaf: number | null;
  currency: string | null;
  operator: string | null;
  operatorRef: string | null;
};

export interface PaymentProvider {
  readonly name: "campay" | "sandbox";
  /** Ask the payer to approve a payment on their phone. */
  requestPayment(p: { amountXaf: number; phone: string; description: string; externalRef: string }): Promise<{ providerRef: string; ussdCode?: string; operator?: string }>;
  /** Ask the provider for the true status. Never trust a webhook's own fields instead of this. */
  getStatus(providerRef: string): Promise<ProviderTransaction>;
  /** Send money to a Mobile Money number. */
  disburse(p: { amountXaf: number; phone: string; description: string; externalRef: string }): Promise<{ providerRef: string; status: ProviderStatus }>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
  }
}

/** Mobile Money numbers are sent as 2376XXXXXXXX (no plus sign). */
export const providerPhone = (e164: string) => e164.replace(/^\+/, "");

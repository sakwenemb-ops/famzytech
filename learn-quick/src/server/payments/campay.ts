import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ProviderError, providerPhone, type PaymentProvider, type ProviderStatus, type ProviderTransaction } from "./types";

/**
 * Campay (campay.net): one API for MTN Mobile Money and Orange Money in Cameroon.
 * Endpoints as used by Campay's official Python SDK and the community Go SDK:
 *   POST /api/token/          { username, password } → { token, expires_in }
 *   POST /api/collect/        { amount, currency, from, description, external_reference } → { reference, ussd_code, operator }
 *   GET  /api/transaction/:ref/ → { reference, status: PENDING|SUCCESSFUL|FAILED, amount, currency, operator, operator_reference, ... }
 *   POST /api/withdraw/       { amount, currency, to, description, external_reference } → { reference, status }
 * Withdrawals must be enabled in the Campay app settings.
 */
export class CampayProvider implements PaymentProvider {
  readonly name = "campay" as const;
  private token: { value: string; expires: number } | null = null;

  constructor(
    private cfg: { baseUrl: string; username?: string; password?: string; accessToken?: string; fetch?: typeof fetch },
  ) {}

  private get fetch() {
    return this.cfg.fetch ?? fetch;
  }

  private async authHeader() {
    if (this.cfg.accessToken) return `Token ${this.cfg.accessToken}`;
    if (this.token && this.token.expires > Date.now()) return `Token ${this.token.value}`;
    if (!this.cfg.username || !this.cfg.password) throw new ProviderError("Campay credentials are not set");
    const res = await this.call("POST", "/api/token/", { username: this.cfg.username, password: this.cfg.password }, false);
    const token = String(res.token ?? "");
    if (!token) throw new ProviderError("Campay did not return a token");
    // Refresh a minute before it expires (expires_in is in seconds); default to 50 minutes
    const ttl = Number(res.expires_in) > 120 ? Number(res.expires_in) - 60 : 3000;
    this.token = { value: token, expires: Date.now() + ttl * 1000 };
    return `Token ${token}`;
  }

  private async call(method: "GET" | "POST", path: string, body?: unknown, auth = true): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    if (auth) headers.Authorization = await this.authHeader();
    let res: Response;
    try {
      res = await this.fetch(`${this.cfg.baseUrl.replace(/\/$/, "")}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      throw new ProviderError(`Campay unreachable: ${(e as Error).message}`, true);
    }
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text);
    } catch {}
    if (res.status === 401 && auth && !this.cfg.accessToken && this.token) {
      // Token expired early: get a new one and try once more
      this.token = null;
      return this.call(method, path, body, auth);
    }
    if (!res.ok) {
      const msg = typeof json.message === "string" ? json.message : typeof json.detail === "string" ? json.detail : text.slice(0, 200);
      throw new ProviderError(`Campay ${path} failed (${res.status}): ${msg}`, res.status >= 500);
    }
    return json;
  }

  async requestPayment(p: { amountXaf: number; phone: string; description: string; externalRef: string }) {
    const res = await this.call("POST", "/api/collect/", {
      amount: String(p.amountXaf), // the official SDK sends the amount as text
      currency: "XAF",
      from: providerPhone(p.phone),
      description: p.description.slice(0, 120),
      external_reference: p.externalRef,
    });
    const ref = String(res.reference ?? "");
    if (!ref) throw new ProviderError("Campay did not return a reference");
    return { providerRef: ref, ussdCode: res.ussd_code ? String(res.ussd_code) : undefined, operator: res.operator ? String(res.operator).toUpperCase() : undefined };
  }

  async getStatus(providerRef: string): Promise<ProviderTransaction> {
    const res = await this.call("GET", `/api/transaction/${encodeURIComponent(providerRef)}/`);
    const status = String(res.status ?? "").toUpperCase();
    const amount = Number(res.amount);
    return {
      status: (["PENDING", "SUCCESSFUL", "FAILED"].includes(status) ? status : "PENDING") as ProviderStatus,
      amountXaf: Number.isFinite(amount) ? Math.round(amount) : null,
      currency: res.currency ? String(res.currency) : null,
      operator: res.operator ? String(res.operator).toUpperCase() : null,
      operatorRef: res.operator_reference ? String(res.operator_reference) : null,
    };
  }

  async disburse(p: { amountXaf: number; phone: string; description: string; externalRef: string }) {
    const res = await this.call("POST", "/api/withdraw/", {
      amount: String(p.amountXaf),
      currency: "XAF",
      to: providerPhone(p.phone),
      description: p.description.slice(0, 120),
      external_reference: p.externalRef,
    });
    const ref = String(res.reference ?? "");
    if (!ref) throw new ProviderError("Campay did not return a reference");
    const status = String(res.status ?? "PENDING").toUpperCase();
    return { providerRef: ref, status: (["SUCCESSFUL", "FAILED"].includes(status) ? status : "PENDING") as ProviderStatus };
  }
}

const b64url = (b: Buffer) => b.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/**
 * Check a Campay webhook signature: a JWT signed with the app's webhook key.
 * Only HS256 is accepted (a token claiming another algorithm, including "none", is refused),
 * and an `exp` claim, if present, must be in the future.
 * Even a valid signature only tells us WHICH payment to re-check: the status is always
 * fetched again from Campay's API before anything is confirmed.
 */
export function verifyCampaySignature(signature: string, webhookKey: string, now = Date.now()): boolean {
  const parts = signature.split(".");
  if (parts.length !== 3 || !webhookKey) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (header?.alg !== "HS256") return false;
    const expected = b64url(createHmac("sha256", webhookKey).update(`${parts[0]}.${parts[1]}`).digest());
    const a = Buffer.from(expected), b = Buffer.from(parts[2]);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (typeof payload?.exp === "number" && payload.exp * 1000 < now) return false;
    return true;
  } catch {
    return false;
  }
}

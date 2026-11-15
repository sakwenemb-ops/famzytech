import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CampayProvider, verifyCampaySignature } from "@/server/payments/campay";

/** A fake Campay server that records requests. */
function fakeCampay(routes: Record<string, (body: unknown, auth: string | null) => [number, unknown]>) {
  const calls: { method: string; path: string; body: unknown; auth: string | null }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const auth = (init.headers as Record<string, string>).Authorization ?? null;
    calls.push({ method: init.method ?? "GET", path, body, auth });
    const handler = routes[`${init.method} ${path}`];
    const [status, json] = handler ? handler(body, auth) : [404, { message: "not found" }];
    return new Response(JSON.stringify(json), { status });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe("Campay provider", () => {
  it("logs in once, then sends the collect request the way Campay expects", async () => {
    const { fetchFn, calls } = fakeCampay({
      "POST /api/token/": () => [200, { token: "tok1", expires_in: 3600 }],
      "POST /api/collect/": () => [200, { reference: "ref-1", ussd_code: "*126#", operator: "mtn" }],
    });
    const c = new CampayProvider({ baseUrl: "https://demo.campay.net/", username: "u", password: "p", fetch: fetchFn });
    const r1 = await c.requestPayment({ amountXaf: 5000, phone: "+237670000000", description: "Lesson", externalRef: "pay_1" });
    await c.requestPayment({ amountXaf: 100, phone: "+237690000000", description: "Lesson", externalRef: "pay_2" });

    expect(r1).toEqual({ providerRef: "ref-1", ussdCode: "*126#", operator: "MTN" });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /api/token/", "POST /api/collect/", "POST /api/collect/"]);
    expect(calls[0].body).toEqual({ username: "u", password: "p" });
    expect(calls[1].auth).toBe("Token tok1");
    expect(calls[1].body).toEqual({ amount: "5000", currency: "XAF", from: "237670000000", description: "Lesson", external_reference: "pay_1" });
  });

  it("reads the transaction status and amount", async () => {
    const { fetchFn, calls } = fakeCampay({
      "GET /api/transaction/ref-9/": () => [200, { reference: "ref-9", status: "SUCCESSFUL", amount: 5000, currency: "XAF", operator: "ORANGE", operator_reference: "OP123" }],
    });
    const c = new CampayProvider({ baseUrl: "https://demo.campay.net", accessToken: "perm", fetch: fetchFn });
    expect(await c.getStatus("ref-9")).toEqual({ status: "SUCCESSFUL", amountXaf: 5000, currency: "XAF", operator: "ORANGE", operatorRef: "OP123" });
    expect(calls[0].auth).toBe("Token perm");
  });

  it("treats an unknown status as still pending, never as paid", async () => {
    const { fetchFn } = fakeCampay({ "GET /api/transaction/x/": () => [200, { status: "SOMETHING_NEW", amount: "5000" }] });
    const c = new CampayProvider({ baseUrl: "https://demo.campay.net", accessToken: "t", fetch: fetchFn });
    expect((await c.getStatus("x")).status).toBe("PENDING");
  });

  it("gets a new token once when Campay says the old one expired", async () => {
    let n = 0;
    const { fetchFn, calls } = fakeCampay({
      "POST /api/token/": () => [200, { token: `tok${++n}`, expires_in: 3600 }],
      "GET /api/transaction/r/": (_, auth) => (auth === "Token tok1" ? [401, { detail: "expired" }] : [200, { status: "PENDING" }]),
    });
    const c = new CampayProvider({ baseUrl: "https://demo.campay.net", username: "u", password: "p", fetch: fetchFn });
    expect((await c.getStatus("r")).status).toBe("PENDING");
    expect(calls.filter((x) => x.path === "/api/token/")).toHaveLength(2);
  });

  it("reports Campay errors", async () => {
    const { fetchFn } = fakeCampay({ "POST /api/collect/": () => [400, { message: "Invalid phone number" }] });
    const c = new CampayProvider({ baseUrl: "https://demo.campay.net", accessToken: "t", fetch: fetchFn });
    await expect(c.requestPayment({ amountXaf: 1, phone: "+237600000000", description: "x", externalRef: "y" })).rejects.toThrow(/Invalid phone number/);
  });

  it("sends withdrawals with the right fields", async () => {
    const { fetchFn, calls } = fakeCampay({ "POST /api/withdraw/": () => [200, { reference: "w1", status: "SUCCESSFUL" }] });
    const c = new CampayProvider({ baseUrl: "https://demo.campay.net", accessToken: "t", fetch: fetchFn });
    expect(await c.disburse({ amountXaf: 8200, phone: "+237677000000", description: "Payout", externalRef: "po_1" })).toEqual({ providerRef: "w1", status: "SUCCESSFUL" });
    expect(calls[0].body).toMatchObject({ amount: "8200", to: "237677000000", currency: "XAF", external_reference: "po_1" });
  });
});

describe("webhook signature", () => {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const sign = (header: unknown, payload: unknown, key: string) => {
    const head = `${b64(header)}.${b64(payload)}`;
    return `${head}.${createHmac("sha256", key).update(head).digest("base64url")}`;
  };

  it("accepts a token signed with the webhook key", () => {
    expect(verifyCampaySignature(sign({ alg: "HS256", typ: "JWT" }, { ref: "r" }, "key"), "key")).toBe(true);
  });

  it("refuses a wrong key, a tampered token, 'none', other algorithms and expired tokens", () => {
    const good = sign({ alg: "HS256" }, { ref: "r" }, "key");
    expect(verifyCampaySignature(good, "other-key")).toBe(false);
    const [h, , s] = good.split(".");
    expect(verifyCampaySignature(`${h}.${b64({ ref: "evil" })}.${s}`, "key")).toBe(false);
    expect(verifyCampaySignature(`${b64({ alg: "none" })}.${b64({ ref: "r" })}.`, "key")).toBe(false);
    expect(verifyCampaySignature(sign({ alg: "HS512" }, { ref: "r" }, "key"), "key")).toBe(false);
    expect(verifyCampaySignature(sign({ alg: "HS256" }, { exp: 1000 }, "key"), "key")).toBe(false);
    expect(verifyCampaySignature("not-a-jwt", "key")).toBe(false);
    expect(verifyCampaySignature(good, "")).toBe(false);
  });
});

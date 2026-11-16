import "server-only";
import { CampayProvider } from "./campay";
import { SandboxProvider } from "./sandbox";
import type { PaymentProvider } from "./types";

let instance: PaymentProvider | undefined;

/** The sandbox only runs on a local computer, never on a live site. */
export function sandboxAllowed() {
  const local = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost").includes("localhost");
  return process.env.NODE_ENV !== "production" || local;
}

export function paymentProvider(): PaymentProvider {
  if (instance) return instance;
  const name = process.env.PAYMENT_PROVIDER ?? "sandbox";
  if (name === "campay") {
    instance = new CampayProvider({
      baseUrl: process.env.CAMPAY_BASE_URL ?? "https://demo.campay.net",
      username: process.env.CAMPAY_USERNAME,
      password: process.env.CAMPAY_PASSWORD,
      accessToken: process.env.CAMPAY_ACCESS_TOKEN,
    });
  } else if (name === "sandbox") {
    if (!sandboxAllowed()) throw new Error("The sandbox payment provider cannot run on a live site. Set PAYMENT_PROVIDER=campay.");
    instance = new SandboxProvider();
  } else {
    throw new Error(`Unknown PAYMENT_PROVIDER "${name}"`);
  }
  return instance;
}

import "server-only";

/**
 * Simple sliding-window limiter kept in this server's memory (like the live hub).
 * Enough for one app server; with several servers, move it to Redis.
 */
const g = globalThis as unknown as { __lqLimits?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__lqLimits ??= new Map());

/** RATE_LIMITS=off is for automated tests on a local computer only; it is ignored on a live site. */
function limitsDisabled() {
  const local = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost").includes("localhost");
  return process.env.RATE_LIMITS === "off" && (process.env.NODE_ENV !== "production" || local);
}

/** Returns true when the action is allowed (and counts it), false when the limit is reached. */
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()) {
  if (limitsDisabled()) return true;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep memory bounded
  if (hits.size > 50_000) for (const k of [...hits.keys()].slice(0, 10_000)) hits.delete(k);
  return true;
}

/** Forget a key (e.g. after a successful login). */
export function resetLimit(key: string) {
  hits.delete(key);
}

/** The visitor's IP address as seen by the reverse proxy (first X-Forwarded-For entry). */
export function clientIp(h: Headers) {
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

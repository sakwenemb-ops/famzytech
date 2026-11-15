/**
 * Phone helpers. Numbers are stored in E.164 (+2376XXXXXXXX).
 * Cameroon prefixes below cover the main ranges; confirm them against current
 * operator allocations before relying on them for payments.
 */
export type CmOperator = "MTN" | "ORANGE" | "NEXTTEL" | "CAMTEL" | "UNKNOWN";

export function normalizePhone(input: string, defaultCountryCode = "237"): string | null {
  let s = input.replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) {
    // Local Cameroon number: 9 digits starting with 6 (mobile) or 2 (fixed)
    if (defaultCountryCode === "237" && /^[62]\d{8}$/.test(s)) s = "+237" + s;
    else return null;
  }
  if (!/^\+\d{8,15}$/.test(s)) return null;
  if (s.startsWith("+237") && !/^\+237[62]\d{8}$/.test(s)) return null;
  return s;
}

export function cameroonOperator(e164: string): CmOperator {
  const m = /^\+237(\d{9})$/.exec(e164);
  if (!m) return "UNKNOWN";
  const n = m[1];
  const p2 = n.slice(0, 2);
  const p3 = Number(n.slice(0, 3));
  if (p2 === "67" || (p3 >= 650 && p3 <= 654) || (p3 >= 680 && p3 <= 684)) return "MTN";
  if (p2 === "69" || (p3 >= 655 && p3 <= 659) || p3 === 640) return "ORANGE";
  if (p2 === "66") return "NEXTTEL";
  if (n.startsWith("2")) return "CAMTEL";
  return "UNKNOWN";
}

export function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

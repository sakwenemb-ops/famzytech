import { describe, expect, it } from "vitest";
import { redactContacts } from "@/lib/contact-filter";
import { categoryOf } from "@/lib/notification-categories";
import { rateLimit } from "@/server/rate-limit";
import { SETTING_RULES } from "@/lib/setting-rules";

describe("contact filter", () => {
  it.each([
    "Appelle-moi au 677 12 34 56",
    "mon numéro +237 6 77 12 34 56",
    "677-123-456",
    "écris à sam.dupont@gmail.com",
    "écris à sam at gmail dot com",
    "voici mon site https://exemple.cm/cours",
    "www.monsite.fr",
    "on se parle sur WhatsApp ?",
    "lien wa.me/237677123456",
  ])("hides contact details: %s", (text) => {
    const r = redactContacts(text);
    expect(r.redacted).toBe(true);
    expect(r.text).toContain("•••");
    expect(r.text).not.toMatch(/\d{6}|@|https?:|www\.|whatsapp/i);
  });

  it.each(["Je suis disponible mardi à 18 h 30.", "Le cours coûte 4 500 FCFA.", "J'ai 2 enfants de 7 et 9 ans.", "Je veux préparer le DELF B2 en 2026.", "Bonjour, c'est possible ?"])(
    "keeps ordinary messages: %s",
    (text) => {
      expect(redactContacts(text)).toEqual({ text, redacted: false });
    },
  );
});

describe("rate limit", () => {
  it("allows up to the limit in the window, then refuses, then allows again", () => {
    const key = `t:${Math.random()}`;
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000, t0 + i)).toBe(true);
    expect(rateLimit(key, 3, 60_000, t0 + 10)).toBe(false);
    expect(rateLimit(key, 3, 60_000, t0 + 60_001)).toBe(true);
  });
});

describe("notification categories", () => {
  it("groups types", () => {
    expect(categoryOf("MESSAGE_NEW")).toBe("messages");
    expect(categoryOf("PAYOUT_PAID")).toBe("payments");
    expect(categoryOf("LESSON_REMINDER_1H")).toBe("lessons");
    expect(categoryOf("DISPUTE_RESOLVED")).toBe("lessons");
    expect(categoryOf("APPLICATION_APPROVED")).toBe("account");
  });
});

describe("admin settings limits", () => {
  it("refuses unsafe values", () => {
    expect(SETTING_RULES.commissionPct.safeParse("60").success).toBe(false);
    expect(SETTING_RULES.commissionPct.safeParse("20").success).toBe(true);
    expect(SETTING_RULES.minPayoutXaf.safeParse("abc").success).toBe(false);
    expect(SETTING_RULES.payoutRequiresApproval.parse("off")).toBe(false);
    expect(SETTING_RULES.payoutRequiresApproval.parse("on")).toBe(true);
  });
});

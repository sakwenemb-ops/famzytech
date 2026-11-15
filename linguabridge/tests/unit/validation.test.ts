import { describe, expect, it } from "vitest";
import { fieldErrors, registerSchema } from "@/lib/validation";

const base = { role: "STUDENT", name: "Awa Ngono", password: "secret123", acceptTerms: "on" };

describe("registerSchema", () => {
  it("accepts a phone-only sign-up and normalises the number", () => {
    const r = registerSchema.parse({ ...base, phone: "6 77 12 34 56" });
    expect(r.phone).toBe("+237677123456");
    expect(r.email).toBeUndefined();
    expect(r.country).toBe("CM");
  });

  it("lower-cases the email", () => {
    expect(registerSchema.parse({ ...base, email: "Awa@Example.COM" }).email).toBe("awa@example.com");
  });

  it("needs an email or a phone", () => {
    const r = registerSchema.safeParse({ ...base });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).email).toBe("contact_required");
  });

  it.each([
    [{ phone: "123" }, "phone", "phone_invalid"],
    [{ email: "nope" }, "email", "email_invalid"],
    [{ email: "a@b.cm", password: "short1" }, "password", "password_min"],
    [{ email: "a@b.cm", password: "longpassword" }, "password", "password_digit"],
    [{ email: "a@b.cm", acceptTerms: undefined }, "acceptTerms", "terms_required"],
    [{ email: "a@b.cm", role: "ADMIN" }, "role", undefined],
  ])("rejects %o", (patch, field, key) => {
    const r = registerSchema.safeParse({ ...base, ...patch });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errs = fieldErrors(r.error);
      expect(errs[field]).toBeDefined();
      if (key) expect(errs[field]).toBe(key);
    }
  });
});

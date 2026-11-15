import { z } from "zod";
import { isEmail, normalizePhone } from "./phone";

export const ROLES_SELF_SERVE = ["STUDENT", "TEACHER"] as const;

export const passwordSchema = z
  .string()
  .min(8, "password_min")
  .max(128)
  .regex(/[A-Za-z]/, "password_letter")
  .regex(/\d/, "password_digit");

export const registerSchema = z
  .object({
    role: z.enum(ROLES_SELF_SERVE),
    name: z.string().trim().min(2, "name_min").max(80),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => v === undefined || isEmail(v), "email_invalid"),
    phone: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? normalizePhone(v) ?? "INVALID" : undefined))
      .refine((v) => v !== "INVALID", "phone_invalid"),
    password: passwordSchema,
    country: z.string().length(2).default("CM"),
    city: z.string().trim().max(80).optional(),
    timeZone: z.string().max(64).default("Africa/Douala"),
    locale: z.enum(["en", "fr"]).default("fr"),
    acceptTerms: z.literal("on", { errorMap: () => ({ message: "terms_required" }) }),
  })
  .refine((v) => v.email || v.phone, { message: "contact_required", path: ["email"] });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(1).max(128),
});

export const otpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "code_invalid"),
  channel: z.enum(["email", "phone"]),
});

export const onboardingSchema = z.object({
  role: z.enum(ROLES_SELF_SERVE),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? normalizePhone(v) ?? "INVALID" : undefined))
    .refine((v) => v !== "INVALID", "phone_invalid"),
  country: z.string().length(2).default("CM"),
  city: z.string().trim().max(80).optional(),
  timeZone: z.string().max(64).default("Africa/Douala"),
});

/** Turn a ZodError into { field: messageKey } for the form. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

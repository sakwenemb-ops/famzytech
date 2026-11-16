"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";
import { Prisma } from "@prisma/client";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { fieldErrors, loginSchema, onboardingSchema, otpSchema, registerSchema } from "@/lib/validation";
import { redirect } from "@/i18n/navigation";
import { sendOtp, verifyOtp, type OtpChannel } from "./otp";
import { dashboardPath, getCurrentUser, isVerified } from "./session";
import { headers } from "next/headers";
import { clientIp, rateLimit } from "./rate-limit";

export type FormState =
  | { errors?: Record<string, string>; message?: string; ok?: boolean; values?: Record<string, string> }
  | undefined;

const formObject = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

/** Echo back what the person typed (never the password) so the form keeps it after an error. */
const keep = (fd: FormData) => {
  const values = formObject(fd);
  delete values.password;
  return values;
};

/** Create a user plus the profile for their role. Teachers also get a draft application. */
async function createProfiles(tx: Prisma.TransactionClient, userId: string, role: "STUDENT" | "TEACHER") {
  if (role === "STUDENT") {
    await tx.studentProfile.create({ data: { userId } });
  } else {
    const teacher = await tx.teacherProfile.create({ data: { userId, spokenLanguages: [] } });
    await tx.teacherApplication.create({ data: { teacherId: teacher.id } });
  }
}

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(formObject(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: keep(fd) };
  // At most 10 new accounts per hour from one network (stops scripted sign-ups and SMS costs)
  if (!rateLimit(`register:${clientIp(await headers())}`, 10, 3_600_000)) return { message: "too_many_attempts", values: keep(fd) };
  const d = parsed.data;

  const clash = await db.user.findFirst({
    where: { OR: [...(d.email ? [{ email: d.email }] : []), ...(d.phone ? [{ phone: d.phone }] : [])] },
    select: { email: true, phone: true },
  });
  if (clash) {
    return {
      errors: clash.email && clash.email === d.email ? { email: "email_taken" } : { phone: "phone_taken" },
      values: keep(fd),
    };
  }

  const passwordHash = await bcrypt.hash(d.password, 12);
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        name: d.name,
        email: d.email,
        phone: d.phone,
        passwordHash,
        role: d.role,
        onboarded: true,
        country: d.country,
        city: d.city,
        timeZone: d.timeZone,
        locale: d.locale,
      },
    });
    await createProfiles(tx, u.id, d.role);
    await tx.auditLog.create({ data: { actorId: u.id, action: "USER_REGISTERED", targetType: "User", targetId: u.id, meta: { role: d.role } } });
    return u;
  });

  // Prefer phone (SMS) when given: most users here sign up with a mobile number.
  await sendOtp(user, user.phone ? "phone" : "email");

  const locale = await getLocale();
  await signIn("credentials", {
    identifier: d.email ?? d.phone,
    password: d.password,
    redirectTo: `/${locale}/verify`,
  });
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(formObject(fd));
  if (!parsed.success) return { message: "invalid_credentials", values: keep(fd) };
  // Slow down password guessing: 10 tries per account and 50 per network every 15 minutes
  const ip = clientIp(await headers());
  if (!rateLimit(`login:${parsed.data.identifier.toLowerCase()}`, 10, 900_000) || !rateLimit(`login-ip:${ip}`, 50, 900_000)) {
    return { message: "too_many_attempts", values: keep(fd) };
  }
  const locale = await getLocale();
  try {
    await signIn("credentials", { ...parsed.data, redirectTo: `/${locale}/dashboard` });
  } catch (e) {
    if (e instanceof AuthError) return { message: "invalid_credentials", values: keep(fd) };
    throw e; // the redirect
  }
}

export async function googleSignInAction() {
  const locale = await getLocale();
  await signIn("google", { redirectTo: `/${locale}/dashboard` });
}

export async function logoutAction() {
  const locale = await getLocale();
  await signOut({ redirectTo: `/${locale}` });
}

export async function verifyAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { message: "session_expired" };
  const parsed = otpSchema.safeParse(formObject(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const res = await verifyOtp(user.id, parsed.data.channel, parsed.data.code);
  if (!res.ok) return { errors: { code: `code_${res.error}` } };

  const locale = await getLocale();
  redirect({ href: user.role === "STUDENT" ? "/student/welcome" : dashboardPath(user.role), locale });
}

export async function resendCodeAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { message: "session_expired" };
  const channel = (fd.get("channel") === "email" ? "email" : "phone") as OtpChannel;
  // Each code costs an SMS: at most 8 a day per person
  if (!rateLimit(`otp:${user.id}`, 8, 86_400_000)) return { message: "too_many_attempts" };
  const res = await sendOtp(user, channel);
  return res.ok ? { ok: true, message: "code_sent" } : { message: `code_${res.error}` };
}

/** OAuth users (Google) pick their role and add a phone number here. */
export async function onboardingAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { message: "session_expired" };
  const locale = await getLocale();
  if (user.onboarded) redirect({ href: dashboardPath(user.role), locale });

  const parsed = onboardingSchema.safeParse(formObject(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: keep(fd) };
  const d = parsed.data;

  if (d.phone && (await db.user.findFirst({ where: { phone: d.phone, NOT: { id: user.id } } }))) {
    return { errors: { phone: "phone_taken" }, values: keep(fd) };
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { role: d.role, phone: d.phone, country: d.country, city: d.city, timeZone: d.timeZone, onboarded: true, locale: locale === "en" ? "en" : "fr" },
    });
    await createProfiles(tx, user.id, d.role);
  });

  const next = d.role === "STUDENT" ? "/student/welcome" : dashboardPath(d.role);
  redirect({ href: isVerified(user) ? next : "/verify", locale });
}

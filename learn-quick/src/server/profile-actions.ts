"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { accountSchema, fieldErrors, learningSchema, passwordChangeSchema } from "@/lib/validation";
import { redirect } from "@/i18n/navigation";
import { assertRole } from "./session";
import type { FormState } from "./auth-actions";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v !== "" ? v : undefined;
};
const strs = (fd: FormData, k: string) => fd.getAll(k).filter((v): v is string => typeof v === "string");

function learningInput(fd: FormData) {
  return {
    learningLanguages: strs(fd, "learningLanguages"),
    englishLevel: str(fd, "englishLevel"),
    frenchLevel: str(fd, "frenchLevel"),
    goals: strs(fd, "goals"),
    availabilityNote: str(fd, "availabilityNote"),
  };
}

/** Student learning profile. `next` = where to go after saving (welcome flow) or stay (settings). */
export async function saveLearningAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await assertRole("STUDENT");
  const parsed = learningSchema.safeParse(learningInput(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const d = parsed.data;

  await db.studentProfile.update({
    where: { userId: user.id },
    data: {
      learningLanguages: d.learningLanguages,
      // Clear the level of a language the student no longer learns
      englishLevel: d.learningLanguages.includes("ENGLISH") ? d.englishLevel : null,
      frenchLevel: d.learningLanguages.includes("FRENCH") ? d.frenchLevel : null,
      goals: d.goals,
      availabilityNote: d.availabilityNote ?? null,
    },
  });

  if (fd.get("next") === "dashboard") redirect({ href: "/student", locale: await getLocale() });
  revalidatePath("/[locale]/student", "layout");
  return { ok: true, message: "saved" };
}

export async function saveAccountAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await assertRole("STUDENT", "TEACHER", "ADMIN");
  const parsed = accountSchema.safeParse({
    name: str(fd, "name") ?? "",
    country: str(fd, "country") ?? "",
    city: str(fd, "city"),
    timeZone: str(fd, "timeZone") ?? "",
    locale: str(fd, "locale"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const d = parsed.data;

  await db.user.update({
    where: { id: user.id },
    data: { name: d.name, country: d.country, city: d.city ?? null, timeZone: d.timeZone, locale: d.locale },
  });

  // Show the page in the language the person just chose
  const current = await getLocale();
  if (d.locale !== current) {
    const base = user.role === "ADMIN" ? "/admin" : user.role === "TEACHER" ? "/teacher" : "/student";
    redirect({ href: `${base}/settings`, locale: d.locale });
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true, message: "saved" };
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await assertRole("STUDENT", "TEACHER", "ADMIN");
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: str(fd, "currentPassword"),
    newPassword: str(fd, "newPassword") ?? "",
    confirmPassword: str(fd, "confirmPassword") ?? "",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Accounts created with Google have no password yet and may set one without the old one
  if (user.passwordHash) {
    const ok = parsed.data.currentPassword && (await bcrypt.compare(parsed.data.currentPassword, user.passwordHash));
    if (!ok) return { errors: { currentPassword: "current_password_wrong" } };
  }

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) } }),
    db.auditLog.create({ data: { actorId: user.id, action: "PASSWORD_CHANGED", targetType: "User", targetId: user.id } }),
  ]);
  return { ok: true, message: "password_changed" };
}

/** Save or unsave a teacher. Only published teachers can be saved. */
export async function toggleFavoriteAction(teacherId: string): Promise<{ saved: boolean }> {
  const user = await assertRole("STUDENT");
  const student = await db.studentProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { id: true } });
  const key = { studentId_teacherId: { studentId: student.id, teacherId } };

  const existing = await db.favoriteTeacher.findUnique({ where: key });
  if (existing) {
    await db.favoriteTeacher.delete({ where: key });
    revalidatePath("/[locale]/student", "page");
    return { saved: false };
  }
  const teacher = await db.teacherProfile.findUnique({ where: { id: teacherId }, select: { isPublished: true } });
  if (!teacher?.isPublished) throw new Error("NOT_FOUND");
  await db.favoriteTeacher.create({ data: { studentId: student.id, teacherId } });
  revalidatePath("/[locale]/student", "page");
  return { saved: true };
}

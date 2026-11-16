"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { fieldErrors } from "@/lib/validation";
import { redirect } from "@/i18n/navigation";
import { assertRole } from "./session";
import { canManage, exerciseInput, fromForm, importExercises, saveExercise } from "./library/manage";
import type { FormState } from "./auth-actions";

export async function saveExerciseAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await assertRole("ADMIN", "TEACHER");
  const parsed = exerciseInput.safeParse(fromForm(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const id = String(fd.get("id") ?? "") || null;
  const ex = await saveExercise(user, id, parsed.data);
  revalidatePath("/[locale]/library/manage", "layout");
  if (!id) redirect({ href: `/library/manage/${ex.id}`, locale: await getLocale() });
  return { ok: true, message: "saved" };
}

export async function setExerciseStatusAction(id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  const user = await assertRole("ADMIN");
  await db.exercise.update({ where: { id }, data: { status } });
  await db.auditLog.create({ data: { actorId: user.id, action: `EXERCISE_${status}`, targetType: "Exercise", targetId: id } });
  revalidatePath("/[locale]/library/manage", "layout");
}

export async function importExercisesAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await assertRole("ADMIN");
  let list: unknown;
  try {
    list = JSON.parse(String(fd.get("json") ?? ""));
  } catch {
    return { errors: { json: "json_invalid" } };
  }
  const res = await importExercises(user, list);
  if ("error" in res) return { errors: { json: "json_invalid" }, message: res.error };
  revalidatePath("/[locale]/library/manage", "layout");
  return { ok: true, message: String(res.count) };
}

export async function manageRoleAction() {
  const user = await assertRole("ADMIN", "TEACHER");
  return canManage(user);
}

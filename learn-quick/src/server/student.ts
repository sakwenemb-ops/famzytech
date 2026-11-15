import "server-only";
import { db } from "@/lib/db";
import type { LearningDefaults } from "@/components/student/learning-form";

export async function getLearningDefaults(userId: string): Promise<LearningDefaults> {
  const p = await db.studentProfile.findUnique({ where: { userId } });
  return {
    learningLanguages: p?.learningLanguages ?? [],
    englishLevel: p?.englishLevel ?? null,
    frenchLevel: p?.frenchLevel ?? null,
    goals: p?.goals ?? [],
    availabilityNote: p?.availabilityNote ?? null,
  };
}

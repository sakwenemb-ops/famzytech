import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedDemo } from "./demo";
import { LIBRARY } from "./library-content";

const db = new PrismaClient();

const SETTINGS: Record<string, unknown> = {
  commissionPct: 18,
  freeCancelHours: 12,
  slotHoldMinutes: 15,
  escrowReleaseHours: 24,
  minPayoutXaf: 5000,
  applicationReviewDays: 5,
  // The library is free for students and teachers; this caps AI-graded answers per account per day
  libraryAiGradesPerDay: 30,
  // Students cannot book a lesson starting sooner than this
  minBookingNoticeHours: 6,
  // A teacher payout or wallet withdrawal waits for an admin to approve it
  payoutRequiresApproval: true,
  // How long a student has to approve a Mobile Money payment on their phone
  paymentTimeoutMinutes: 5,
};

async function main() {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await db.platformSetting.upsert({ where: { key }, create: { key, value: value as never }, update: {} });
  }

  // Platform ledger accounts (fixed ids, see src/server/ledger.ts)
  for (const type of ["PLATFORM_REVENUE", "PLATFORM_CLEARING", "EXTERNAL", "PAYOUT_IN_FLIGHT"] as const) {
    const id = `platform_${type.toLowerCase()}`;
    await db.ledgerAccount.upsert({ where: { id }, create: { id, type }, update: {} });
  }

  // Translation library: starter exercises (published) and one timed exam per level
  for (const e of LIBRARY) {
    const data = {
      type: e.type,
      direction: e.direction,
      level: e.level,
      topic: e.topic,
      sourceText: e.sourceText,
      references: e.references,
      gapTemplate: e.gapTemplate ?? null,
      options: e.options ?? undefined,
      keyVocabulary: e.keyVocabulary ?? undefined,
      commonMistakes: e.commonMistakes ?? null,
    };
    await db.exercise.upsert({ where: { code: e.code }, create: { code: e.code, status: "PUBLISHED", ...data }, update: data });
  }
  for (const level of ["A1", "A2", "B1", "B2", "C1", "C2"] as const) {
    const title = `exam:${level}`;
    if (await db.test.findFirst({ where: { title } })) continue;
    const items = await db.exercise.findMany({ where: { level, code: { not: null }, status: "PUBLISHED" }, orderBy: { code: "asc" } });
    await db.test.create({
      data: { title, level, isTimedExam: true, timeLimitMin: 30, passMark: 70, status: "PUBLISHED", items: { create: items.map((ex, i) => ({ exerciseId: ex.id, position: i + 1, points: 10 })) } },
    });
  }
  console.log(`Library ready: ${LIBRARY.length} exercises, 6 exams.`);

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    await db.user.upsert({
      where: { email },
      create: {
        email,
        name: "Admin",
        role: "ADMIN",
        onboarded: true,
        emailVerified: new Date(),
        passwordHash: await bcrypt.hash(password, 12),
      },
      update: {},
    });
    console.log(`Admin user ready: ${email}`);
  } else {
    console.log("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set: no admin user created.");
  }

  if (process.env.SEED_DEMO === "1") {
    if (process.env.NODE_ENV === "production") throw new Error("Refusing to create demo data in production");
    await seedDemo(db);
  }
}

main().finally(() => db.$disconnect());

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
};

async function main() {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await db.platformSetting.upsert({ where: { key }, create: { key, value: value as never }, update: {} });
  }

  // Platform ledger accounts (no user)
  for (const type of ["PLATFORM_REVENUE", "PLATFORM_CLEARING"] as const) {
    const exists = await db.ledgerAccount.findFirst({ where: { userId: null, type } });
    if (!exists) await db.ledgerAccount.create({ data: { type } });
  }

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
}

main().finally(() => db.$disconnect());

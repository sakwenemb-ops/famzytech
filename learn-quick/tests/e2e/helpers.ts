import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import "./test-env";
export const db = new PrismaClient();

/**
 * The production server never uses a fixed code, so tests replace the stored
 * code hash for this user with the hash of a known code.
 */
export async function setKnownCode(where: { email?: string; phone?: string }, code = "123456") {
  const user = await db.user.findFirstOrThrow({ where });
  const hash = createHash("sha256").update(`${code}:${process.env.AUTH_SECRET ?? ""}`).digest("hex");
  const token = await db.verificationToken.findFirstOrThrow({ where: { identifier: { endsWith: `:${user.id}` } } });
  await db.verificationToken.update({ where: { token: token.token }, data: { token: `${hash}:${user.id}`, attempts: 0 } });
  return code;
}


let counter = 0;
const uid = () => `${Date.now()}${counter++}`;

/** A verified user created straight in the database, ready to log in with password "secret123". */
export async function createUser(role: "STUDENT" | "TEACHER", opts: { learning?: boolean } = {}) {
  const email = `${role.toLowerCase()}${uid()}@example.test`;
  const user = await db.user.create({
    data: {
      email,
      name: role === "STUDENT" ? "Sam Student" : "Tina Teacher",
      role,
      onboarded: true,
      emailVerified: new Date(),
      passwordHash: await bcrypt.hash("secret123", 4),
      ...(role === "STUDENT"
        ? { studentProfile: { create: opts.learning ? { learningLanguages: ["FRENCH"], frenchLevel: "A2" } : {} } }
        : { teacherProfile: { create: { spokenLanguages: [], application: { create: {} } } } }),
    },
    include: { teacherProfile: true, studentProfile: true },
  });
  return { ...user, email, password: "secret123" };
}

export async function createTeacher(opts: { published: boolean }) {
  const u = await createUser("TEACHER");
  const teacher = await db.teacherProfile.update({
    where: { id: u.teacherProfile!.id },
    data: {
      isPublished: opts.published,
      subjects: ["FRENCH"],
      spokenLanguages: [{ language: "FRENCH", level: "NATIVE" }],
      headlineFr: "Professeure de français pour débutants",
      headlineEn: "French teacher for beginners",
      bioFr: "Je rends le français facile.",
      hourlyRateXaf: 4500,
      trialRateXaf: 2000,
      specialties: ["CONVERSATION"],
      badges: { create: [{ type: "VERIFIED_ID" }] },
    },
  });
  return { user: u, teacher };
}

export async function login(page: Page, email: string, password = "secret123", locale = "fr") {
  await page.goto(`/${locale}/login`);
  await page.getByLabel(locale === "fr" ? "E-mail ou numéro de téléphone" : "Email or phone number").fill(email);
  await page.getByLabel(locale === "fr" ? "Mot de passe" : "Password").fill(password);
  await page.getByRole("button", { name: locale === "fr" ? "Se connecter" : "Log in" }).click();
  // Wait until the session cookie is set and we have left the login page
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

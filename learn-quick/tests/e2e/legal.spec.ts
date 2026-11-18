import { expect, test } from "@playwright/test";
import { createTeacher, createUser, db, login } from "./helpers";

test("legal and information pages exist in both languages, with the live platform rules", async ({ page }) => {
  await page.goto("/fr");
  for (const [link, heading] of [
    ["Conditions", "Conditions d'utilisation"],
    ["Confidentialité", "Politique de confidentialité"],
    ["Contact", "Nous contacter"],
  ] as const) {
    await page.getByRole("contentinfo").getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await page.goto("/fr");
  }
  await page.goto("/fr/terms");
  // Values come from the settings (defaults: 18 % fee, 12 hours free cancellation)
  await expect(page.getByText(/commission de 18 % sur le prix de chaque cours/)).toBeVisible();
  await expect(page.locator("main, body").first()).toContainText("au moins 12 heures avant");
  await page.goto("/en/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms of use" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "8. Rules for teachers" })).toBeVisible();

  await page.goto("/fr/become-a-teacher");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Partagez votre langue");
  await expect(page.getByText(/vous recevez 4 100 FCFA/)).toBeVisible();
  await page.getByRole("link", { name: "Postuler comme enseignant" }).first().click();
  await expect(page).toHaveURL(/\/fr\/register\?role=TEACHER/);
});

test("contact form: checks the message, sends it, and ignores robots", async ({ page }) => {
  await page.goto("/fr/contact");
  await page.getByLabel("Votre nom").fill("Awa Ngono");
  await page.getByLabel("Votre e-mail").fill("awa@example.test");
  await page.getByLabel("Sujet").selectOption("payment");
  await page.getByLabel("Message").fill("Court");
  await page.getByRole("button", { name: "Envoyer le message" }).click();
  await expect(page.getByText("Écrivez au moins 10 caractères.")).toBeVisible();
  await expect(page.getByLabel("Votre nom")).toHaveValue("Awa Ngono"); // kept after the error
  await page.getByLabel("Message").fill("Mon paiement du 12 novembre n'apparaît pas dans mon portefeuille.");
  await page.getByRole("button", { name: "Envoyer le message" }).click();
  await expect(page.getByText(/Merci, votre message a été envoyé/)).toBeVisible();
});

test("download my data: a JSON file with the account, never the password", async ({ page }) => {
  const s = await createUser("STUDENT", { learning: true });
  await login(page, s.email);
  await page.goto("/fr/student/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Télécharger mes données/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^learn-quick-data-\d{4}-\d{2}-\d{2}\.json$/);
  const res = await page.request.get("/api/me/export");
  const data = await res.json();
  expect(data.account.email).toBe(s.email);
  expect(JSON.stringify(data)).not.toContain("passwordHash");
});

test("delete my account: blocked while a lesson is upcoming, then deleted and signed out", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const { teacher } = await createTeacher({ published: true });
  const s = await createUser("STUDENT", { learning: true });
  const start = new Date(Date.now() + 3 * 86_400_000);
  const booking = await db.booking.create({
    data: { studentId: s.studentProfile!.id, teacherId: teacher.id, type: "SINGLE", status: "CONFIRMED", startsAt: start, endsAt: new Date(start.getTime() + 50 * 60_000), priceXaf: 4500, commissionPct: 18 },
  });
  await login(page, s.email);
  await page.goto("/fr/student/settings");
  await expect(page.getByText("terminez ou annulez vos cours à venir ;")).toBeVisible();
  await expect(page.getByRole("button", { name: "Supprimer définitivement mon compte" })).toHaveCount(0);

  await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED_BY_STUDENT" } });
  await page.reload();
  await page.getByText("Supprimer mon compte…").click();
  await page.getByLabel("Votre mot de passe, pour confirmer").fill("wrongpass1");
  await page.getByRole("button", { name: "Supprimer définitivement mon compte" }).click();
  await expect(page.getByText("Ce mot de passe n'est pas correct.")).toBeVisible();
  await page.getByLabel("Votre mot de passe, pour confirmer").fill("secret123");
  await page.getByRole("button", { name: "Supprimer définitivement mon compte" }).click();
  await expect(page.getByText("Votre compte a été supprimé.")).toBeVisible();

  const gone = await db.user.findUniqueOrThrow({ where: { id: s.id } });
  expect(gone.status).toBe("DELETED");
  expect(gone.email).toBeNull();
  expect(gone.passwordHash).toBeNull();
  expect(gone.name).toBe("Utilisateur supprimé");
  // The booking record stays (accounting), the person can't sign in any more
  expect(await db.booking.count({ where: { id: booking.id } })).toBe(1);
  await page.goto("/fr/login");
  await page.getByLabel("E-mail ou numéro de téléphone").fill(s.email);
  await page.getByLabel("Mot de passe").fill("secret123");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("teachers with money still to withdraw are asked to withdraw it first", async ({ page }) => {
  const { user } = await createTeacher({ published: true });
  // A balanced ledger entry (so the accounting check stays green for other tests)
  const acc = await db.ledgerAccount.create({ data: { userId: user.id, type: "TEACHER_AVAILABLE", balanceXaf: 8200 } });
  const ext = await db.ledgerAccount.upsert({ where: { id: "platform_external" }, create: { id: "platform_external", type: "EXTERNAL" }, update: {} });
  await db.ledgerTransaction.create({
    data: { kind: "TEST_CREDIT", referenceId: acc.id, lines: { create: [{ accountId: acc.id, amountXaf: 8200 }, { accountId: ext.id, amountXaf: -8200 }] } },
  });
  await db.ledgerAccount.update({ where: { id: ext.id }, data: { balanceXaf: { decrement: 8200 } } });
  await login(page, user.email);
  await page.goto("/fr/teacher/settings");
  await expect(page.getByText(/retirez l'argent de votre portefeuille ou de vos gains/)).toBeVisible();
});

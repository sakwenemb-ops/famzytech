import { expect, test, type Page } from "@playwright/test";
import { setKnownCode } from "./helpers";

const uniquePhone = () => `6${String(Date.now()).slice(-8)}`; // 9 digits starting with 6
const uniqueEmail = () => `t${Date.now()}@example.test`;

async function register(page: Page, opts: { role: "Apprendre" | "Enseigner"; phone?: string; email?: string }) {
  await page.goto("/fr/register");
  await page.getByText(opts.role, { exact: true }).click();
  await page.getByLabel("Nom complet").fill("Awa Ngono");
  if (opts.phone) await page.getByLabel("Numéro de mobile").fill(opts.phone);
  if (opts.email) await page.getByLabel("E-mail").fill(opts.email);
  await page.getByLabel("Mot de passe").fill("secret123");
  await page.getByLabel(/J'accepte/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
}

test("student signs up with phone, confirms code, sees dashboard, logs out and in", async ({ page }) => {
  const phone = uniquePhone();
  await register(page, { role: "Apprendre", phone });

  await expect(page).toHaveURL(/\/fr\/verify$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("numéro de téléphone");

  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("Ce code est incorrect.")).toBeVisible();

  await page.getByLabel("Code").fill(await setKnownCode({ phone: `+237${phone}` }));
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page).toHaveURL(/\/fr\/student$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour, Awa");

  // Students cannot open the teacher or admin dashboards
  await page.goto("/fr/teacher");
  await expect(page).toHaveURL(/\/fr\/student$/);
  await page.goto("/fr/admin");
  await expect(page).toHaveURL(/\/fr\/student$/);

  await page.getByRole("button", { name: "Se déconnecter" }).first().click();
  await expect(page).toHaveURL(/\/fr$/);

  await page.goto("/fr/login");
  await page.getByLabel("E-mail ou numéro de téléphone").fill(`+237 ${phone}`);
  await page.getByLabel("Mot de passe").fill("secret123");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/fr\/student$/);
});

test("teacher signs up with email and sees a draft application", async ({ page }) => {
  const email = uniqueEmail();
  await register(page, { role: "Enseigner", email });
  await expect(page).toHaveURL(/\/fr\/verify$/);
  await page.getByLabel("Code").fill(await setKnownCode({ email }));
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page).toHaveURL(/\/fr\/teacher$/);
  await expect(page.getByText("Pas encore envoyée")).toBeVisible();
  await expect(page.getByText("0 étapes sur 10 terminées")).toBeVisible();
});

test("form errors are shown and typed values are kept", async ({ page }) => {
  await page.goto("/fr/register");
  await page.getByLabel("Nom complet").fill("Awa Ngono");
  await page.getByLabel("Numéro de mobile").fill("123");
  await page.getByLabel("Mot de passe").fill("short");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page.getByText("Ce numéro n'est pas valide")).toBeVisible();
  await expect(page.getByText("au moins 8 caractères")).toBeVisible();
  await expect(page.getByText("Vous devez accepter les conditions")).toBeVisible();
  await expect(page.getByLabel("Nom complet")).toHaveValue("Awa Ngono");
});

test("duplicate phone is refused", async ({ page, context }) => {
  const phone = uniquePhone();
  await register(page, { role: "Apprendre", phone });
  await expect(page).toHaveURL(/\/verify$/);
  await context.clearCookies();
  await register(page, { role: "Apprendre", phone });
  await expect(page.getByText("Un compte utilise déjà ce numéro.")).toBeVisible();
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/en/login");
  await page.getByLabel("Email or phone number").fill("nobody@example.test");
  await page.getByLabel("Password").fill("wrongpass1");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Wrong email/phone or password.")).toBeVisible();
});

test("admin sees the platform overview", async ({ page }) => {
  test.skip(!process.env.SEED_ADMIN_EMAIL, "needs a seeded admin");
  await page.goto("/en/login");
  await page.getByLabel("Email or phone number").fill(process.env.SEED_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/en\/admin$/);
  await expect(page.getByText("Newest users")).toBeVisible();
});

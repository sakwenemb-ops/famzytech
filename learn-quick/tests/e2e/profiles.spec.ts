import { expect, test } from "@playwright/test";
import { createTeacher, createUser, db, login } from "./helpers";

test.describe("student learning profile", () => {
  test("welcome step: needs a language and a level, then shows on the dashboard", async ({ page }) => {
    const u = await createUser("STUDENT");
    await login(page, u.email);
    await expect(page).toHaveURL(/\/fr\/student$/);
    await expect(page.getByText("Complétez votre profil d'apprentissage")).toBeVisible();

    await page.getByRole("link", { name: "Compléter mon profil" }).click();
    await expect(page).toHaveURL(/\/fr\/student\/welcome$/);

    await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
    await expect(page.getByText("Choisissez au moins une langue.")).toBeVisible();

    await page.getByText("Anglais", { exact: true }).click();
    await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
    await expect(page.getByText("Choisissez votre niveau.")).toBeVisible();

    await page.getByText("B1 · Intermédiaire", { exact: true }).click();
    await page.getByText("Examen IELTS").click();
    await page.getByRole("button", { name: "Enregistrer et continuer" }).click();

    await expect(page).toHaveURL(/\/fr\/student$/);
    await expect(page.getByText("J'apprends : anglais")).toBeVisible();
    await expect(page.getByText("Complétez votre profil d'apprentissage")).toHaveCount(0);

    const p = await db.studentProfile.findUniqueOrThrow({ where: { userId: u.id } });
    expect(p.learningLanguages).toEqual(["ENGLISH"]);
    expect(p.englishLevel).toBe("B1");
    expect(p.goals).toEqual(["IELTS"]);
  });
});

test.describe("settings", () => {
  test("change name and interface language", async ({ page }) => {
    const u = await createUser("STUDENT", { learning: true });
    await login(page, u.email);
    await page.goto("/fr/student/settings");

    await page.getByLabel("Nom complet").fill("Samuel Etoga");
    await page.getByLabel("Langue de l'interface").selectOption("en");
    await page.getByRole("button", { name: "Enregistrer les modifications" }).click();

    await expect(page).toHaveURL(/\/en\/student\/settings$/);
    await expect(page.getByLabel("Full name")).toHaveValue("Samuel Etoga");
    const saved = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(saved.locale).toBe("en");
  });

  test("change password: wrong current password refused, then new password works", async ({ page }) => {
    const u = await createUser("TEACHER");
    await login(page, u.email);
    await page.goto("/fr/teacher/settings");

    await page.getByLabel("Mot de passe actuel").fill("wrongpass1");
    await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("newpass123");
    await page.getByLabel("Répétez le nouveau mot de passe").fill("newpass123");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page.getByText("Votre mot de passe actuel n'est pas correct.")).toBeVisible();

    await page.getByLabel("Mot de passe actuel").fill("secret123");
    await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("newpass123");
    await page.getByLabel("Répétez le nouveau mot de passe").fill("different1");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page.getByText("Les deux mots de passe ne sont pas identiques.")).toBeVisible();

    await page.getByLabel("Mot de passe actuel").fill("secret123");
    await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("newpass123");
    await page.getByLabel("Répétez le nouveau mot de passe").fill("newpass123");
    await page.getByRole("button", { name: "Changer le mot de passe" }).click();
    await expect(page.getByText("Votre mot de passe a été changé.")).toBeVisible();

    await page.context().clearCookies();
    await login(page, u.email, "newpass123");
    await expect(page).toHaveURL(/\/fr\/teacher$/);
  });
});

test.describe("public teacher profile", () => {
  test("visitors see a published profile and are asked to log in to save", async ({ page }) => {
    const { teacher } = await createTeacher({ published: true });
    await page.goto(`/fr/teachers/${teacher.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tina Teacher");
    await expect(page.getByText("Professeure de français pour débutants")).toBeVisible();
    await expect(page.getByText("4 500 FCFA")).toBeVisible();
    await expect(page.getByText("Identité vérifiée")).toBeVisible();
    await expect(page.getByRole("link", { name: "Connectez-vous pour enregistrer cet enseignant" })).toBeVisible();

    // English page falls back to the French bio and says so
    await page.goto(`/en/teachers/${teacher.id}`);
    await expect(page.getByText("Je rends le français facile.")).toBeVisible();
    await expect(page.getByText(/Shown in french/)).toBeVisible();
  });

  test("unpublished profiles: 404 for others, preview for the owner", async ({ page }) => {
    const { user, teacher } = await createTeacher({ published: false });
    const res = await page.goto(`/fr/teachers/${teacher.id}`);
    expect(res?.status()).toBe(404);

    await login(page, user.email);
    await expect(page).toHaveURL(/\/fr\/teacher$/);
    await page.getByRole("link", { name: "Aperçu de mon profil" }).click();
    await expect(page.getByText(/Aperçu : les élèves ne verront ce profil/)).toBeVisible();
  });

  test("a student saves a teacher and finds them on the dashboard", async ({ page }) => {
    const { teacher } = await createTeacher({ published: true });
    const s = await createUser("STUDENT", { learning: true });
    await login(page, s.email);
    await page.goto(`/fr/teachers/${teacher.id}`);

    const save = page.getByRole("button", { name: "Enregistrer l'enseignant" });
    await save.click();
    await expect(page.getByRole("button", { name: "Enregistré" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => db.favoriteTeacher.count({ where: { teacherId: teacher.id } })).toBe(1);

    await page.goto("/fr/student");
    const card = page.getByRole("link", { name: /Tina Teacher/ });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Français · 4 500 FCFA");

    // Unsave
    await page.goto(`/fr/teachers/${teacher.id}`);
    await page.getByRole("button", { name: "Enregistré" }).click();
    await expect(page.getByRole("button", { name: "Enregistrer l'enseignant" })).toBeVisible();
    // The button changes at once; wait for the server to finish saving before leaving the page
    await expect.poll(() => db.favoriteTeacher.count({ where: { teacherId: teacher.id } })).toBe(0);
    await page.goto("/fr/student");
    await expect(page.getByRole("link", { name: /Tina Teacher/ })).toHaveCount(0);
  });
});

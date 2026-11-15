import { expect, test } from "@playwright/test";

test.describe("French browser", () => {
  test.use({ locale: "fr-FR" });
  test("home page follows the browser language, then switches to English", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/fr$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Parlez avec assurance");

  await page.getByRole("button", { name: /Langue/ }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Speak with confidence");
  });
});

test("an English browser lands on /en", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
});

test("no horizontal scroll on the home page", async ({ page }) => {
  await page.goto("/fr");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("dashboards redirect to login when signed out", async ({ page }) => {
  for (const p of ["/fr/student", "/fr/teacher", "/en/admin"]) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("no horizontal scroll on the teacher application", async ({ page }) => {
  const { createUser, login } = await import("./helpers");
  const u = await createUser("TEACHER");
  await login(page, u.email);
  for (const step of ["about", "availability", "identity"]) {
    await page.goto(`/fr/teacher/application/${step}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, step).toBeLessThanOrEqual(0);
  }
});

test("no horizontal scroll on the catalogue, a profile, and the lessons page", async ({ page }) => {
  const { createTeacher, createUser, login } = await import("./helpers");
  const { teacher } = await createTeacher({ published: true });
  const s = await createUser("STUDENT", { learning: true });
  await login(page, s.email);
  for (const path of ["/fr/teachers", `/fr/teachers/${teacher.id}`, "/fr/student/lessons"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

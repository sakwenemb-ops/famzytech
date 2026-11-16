import { expect, test, type Locator, type Page } from "@playwright/test";
import { createTeacher, createUser, db, login } from "./helpers";
import { TEST_ENV } from "./test-env";
import { LIBRARY } from "../../prisma/library-content";

/** The library exercise shown in a question card. */
async function exerciseOf(section: Locator) {
  const source = (await section.locator("blockquote").innerText()).trim();
  const ex = LIBRARY.find((e) => e.sourceText === source);
  if (!ex) throw new Error(`Unknown exercise: ${source}`);
  return ex;
}

async function answer(section: Locator, ex: (typeof LIBRARY)[number], text: string) {
  if (ex.type === "MULTIPLE_CHOICE") await section.getByText(text, { exact: true }).click();
  else if (ex.type === "FILL_GAP") await section.getByRole("textbox").fill(text);
  else await section.getByLabel("Votre traduction").fill(text);
}

const correctAnswer = (ex: (typeof LIBRARY)[number]) => (ex.type === "MULTIPLE_CHOICE" ? ex.options!.find((o) => o.correct)!.text : ex.references[0]);

async function startPractice(page: Page, direction: "EN_FR" | "FR_EN", level: string) {
  await page.goto("/fr/library");
  await page.getByLabel("Sens").selectOption(direction);
  await page.getByLabel("Niveau").selectOption(level);
  await page.getByRole("button", { name: "Commencer l'entraînement" }).click();
  await expect(page).toHaveURL(/\/library\/attempt\//);
}

test("practice: AI correction with highlighted mistakes, hint penalty, and the right overall score", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const student = await createUser("STUDENT", { learning: true });
  await login(page, student.email);
  await startPractice(page, "EN_FR", "B1");

  const sections = page.locator("section[data-item]");
  await expect(sections).toHaveCount(5);
  for (const section of await sections.all()) {
    const ex = await exerciseOf(section);
    if (ex.code === "en-fr-b1-01") await answer(section, ex, "J'habite ici pour deux ans."); // a mistake
    else if (ex.code === "en-fr-b1-02") continue; // left empty
    else if (ex.code === "en-fr-b1-03") {
      await section.getByRole("button", { name: "Afficher les mots clés" }).click();
      await expect(section.getByText("vouloir que")).toBeVisible();
      await answer(section, ex, "viennes");
    } else await answer(section, ex, correctAnswer(ex));
  }
  // Accent buttons insert at the cursor
  const b102 = sections.filter({ hasText: "If I had more time" });
  await b102.getByLabel("Votre traduction").fill("caf");
  await b102.getByRole("button", { name: "Insérer é", exact: true }).click();
  await expect(b102.getByLabel("Votre traduction")).toHaveValue("café");
  await b102.getByLabel("Votre traduction").fill("");
  await expect(page.getByText("Enregistré").first()).toBeVisible();

  await page.getByRole("button", { name: "Terminer et voir mes résultats" }).click();
  await expect(page).toHaveURL(/\/library\/results\//);
  // (66 + 0 + 100×0.8 + 100 + 100) / 5 = 69.2 → 69 %, below 70 % → one level lower
  await expect(page.getByTestId("score")).toHaveText("69 %", { timeout: 20_000 });
  await expect(page.getByText("A2", { exact: true })).toBeVisible();

  const wrong = page.locator("li[data-result]").filter({ hasText: "I have been living here" });
  await expect(wrong.locator("mark")).toContainText("J'habite ici");
  await expect(wrong.getByText("Explication de test.")).toBeVisible();
  await expect(wrong.getByText("Version corrigée")).toBeVisible();
  await expect(wrong.getByText("Sens")).toBeVisible();
  await expect(page.getByText("Indice utilisé (−20 %)")).toBeVisible();

  const attempt = await db.testAttempt.findFirstOrThrow({ where: { userId: student.id }, include: { answers: true } });
  expect(attempt.status).toBe("GRADED");
  expect(attempt.answers.filter((a) => a.gradedBy === "claude")).toHaveLength(2); // the two typed translations
});

test("timed exam: all correct → passed, with a practice certificate", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const student = await createUser("STUDENT", { learning: true });
  await login(page, student.email);
  await page.goto("/fr/library");
  await page.locator("li").filter({ hasText: "Examen A1" }).getByRole("button", { name: "Commencer l'examen" }).click();
  await expect(page).toHaveURL(/\/library\/attempt\//);
  await expect(page.getByRole("timer")).toContainText(/Temps restant : (29|30):/);

  const sections = page.locator("section[data-item]");
  await expect(sections).toHaveCount(10);
  for (const section of await sections.all()) {
    const ex = await exerciseOf(section);
    await answer(section, ex, correctAnswer(ex));
  }
  await page.getByRole("button", { name: "Terminer et voir mes résultats" }).click();
  await expect(page.getByTestId("score")).toHaveText("100 %", { timeout: 20_000 });
  await expect(page.getByText("Réussi : vous avez obtenu un certificat d'entraînement.")).toBeVisible();
  await page.getByRole("link", { name: "Voir mon certificat" }).click();
  await expect(page.getByRole("heading", { name: "Certificat d'entraînement" })).toBeVisible();
  await expect(page.getByText(/Sam Student a réussi l'examen de traduction Learn Quick de niveau A1/)).toBeVisible();
  await expect(page.getByText(/Ce n'est pas un diplôme de langue officiel/)).toBeVisible();
  const a = await db.testAttempt.findFirstOrThrow({ where: { userId: student.id } });
  expect(a.certificateNo).toMatch(/^LQ-A1-[0-9A-F]{8}$/);

  // Progress page
  await page.goto("/fr/library/history");
  await expect(page.getByText(/Excellent travail ! Essayez le niveau A2 ensuite./)).toBeVisible();
});

test("if the AI grader fails, a basic score is shown and the correction is retried later", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const student = await createUser("STUDENT", { learning: true });
  await login(page, student.email);
  await startPractice(page, "FR_EN", "A1");
  const sentence = page.locator("section[data-item]").filter({ hasText: "Traduisez la phrase" }).first();
  await sentence.getByLabel("Votre traduction").fill("FAIL_GRADER I have two brothers");
  await page.getByRole("button", { name: "Terminer et voir mes résultats" }).click();
  await expect(page.getByText(/Certaines corrections sont encore préparées par l'IA/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Note immédiate \(comparaison avec des traductions modèles/)).toBeVisible();
  const a = await db.testAttempt.findFirstOrThrow({ where: { userId: student.id }, include: { answers: true } });
  expect(a.status).toBe("PENDING_REVIEW");
  expect(a.answers.find((x) => x.gradedBy === "basic-retry")?.gradeAttempts).toBe(1);
});

test("content: admins create, check and publish; teachers who aren't approved can't", async ({ browser }) => {
  const ap = await browser.newPage();
  await login(ap, TEST_ENV.SEED_ADMIN_EMAIL, TEST_ENV.SEED_ADMIN_PASSWORD);
  await ap.goto("/fr/library/manage/new");
  await ap.getByLabel("Type").selectOption("FILL_GAP");
  await ap.getByLabel("Sens").selectOption("FR_EN");
  await ap.getByLabel("Niveau").selectOption("C2");
  await ap.getByLabel("Thème").selectOption("LAW");
  const code = `test-${Date.now()}`;
  await ap.getByLabel("Code").fill(code);
  await ap.getByLabel("Texte à traduire").fill("Le juge a rendu sa décision.");
  await ap.getByLabel("Traduction avec ___ pour le blanc").fill("The judge delivered his decision.");
  await ap.getByLabel("Mots acceptés pour le blanc (un par ligne)").fill("delivered");
  await ap.getByRole("button", { name: "Enregistrer" }).click();
  await expect(ap.getByText("Mettez exactement un ___ à l'endroit du blanc.")).toBeVisible();
  await ap.getByLabel("Traduction avec ___ pour le blanc").fill("The judge ___ his decision.");
  await ap.getByRole("button", { name: "Enregistrer" }).click();
  await expect(ap).toHaveURL(/\/library\/manage\/c/);
  await ap.getByRole("button", { name: "Publier" }).click();
  await expect.poll(async () => (await db.exercise.findUniqueOrThrow({ where: { code } })).status).toBe("PUBLISHED");

  // JSON import
  await ap.goto("/fr/library/manage");
  await ap.getByLabel("Importer des exercices (JSON)").fill(
    JSON.stringify([{ code: `imp-${Date.now()}`, type: "SENTENCE", direction: "EN_FR", level: "C2", topic: "LAW", sourceText: "The court adjourned.", references: ["Le tribunal a levé la séance."] }]),
  );
  await ap.getByRole("button", { name: "Importer" }).click();
  await expect(ap.getByText("1 exercice importé.")).toBeVisible();

  const { user } = await createTeacher({ published: false });
  const tp = await browser.newPage();
  await login(tp, user.email);
  expect((await tp.goto("/fr/library/manage"))?.status()).toBe(404);
});

test("visitors see the library and are invited to sign up", async ({ page }) => {
  await page.goto("/fr/library");
  await expect(page.getByRole("heading", { level: 1, name: "Bibliothèque de traduction" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Inscrivez-vous gratuitement pour vous entraîner" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Commencer l'examen" })).toHaveCount(0);
});

import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createUser, db, login } from "./helpers";

// Small but real files: the server checks the first bytes, not the name
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(64)]);
const file = (name: string, mimeType: string, buffer: Buffer) => ({ name, mimeType, buffer });

const ADMIN = { email: process.env.SEED_ADMIN_EMAIL ?? "", password: process.env.SEED_ADMIN_PASSWORD ?? "" };

async function saveAndContinue(page: Page, nextSlug: string) {
  await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
  await expect(page).toHaveURL(new RegExp(`/fr/teacher/application/${nextSlug}$`));
}

async function fillApplication(page: Page) {
  await page.goto("/fr/teacher/application");
  await expect(page).toHaveURL(/\/application\/about$/);

  // 1. About
  await page.getByText("Français", { exact: true }).first().click();
  await page.getByLabel("Langue", { exact: true }).selectOption("FRENCH");
  await page.getByLabel("Niveau", { exact: true }).selectOption("NATIVE");
  await saveAndContinue(page, "photo");

  // 2. Photo
  await page.getByLabel("Ajouter une photo").setInputFiles(file("me.png", "image/png", PNG));
  await expect(page.locator('img[src^="/api/files/"]')).toBeVisible();
  await page.getByRole("link", { name: "Certificats d'enseignement" }).last().click();

  // 3. Certificates
  await page.getByLabel("Nom du certificat").fill("TEFL (120 heures)");
  await page.getByLabel("Délivré par").fill("TEFL Academy");
  await page.getByLabel("Choisir un fichier").setInputFiles(file("tefl.pdf", "application/pdf", PDF));
  await expect(page.getByText("Envoyé")).toBeVisible();
  await page.getByRole("button", { name: "Ajouter un certificat" }).click();
  await expect(page.getByText("TEFL (120 heures)")).toBeVisible();
  await page.getByRole("link", { name: "Formation" }).last().click();

  // 4. Education: none
  await page.getByText("Je n'ai pas de diplôme universitaire").click();
  await expect(page.getByRole("checkbox", { name: /Je n'ai pas de diplôme/ })).toBeChecked();
  await page.getByRole("link", { name: "Description du profil" }).last().click();

  // 5. Description
  const bio = "J'enseigne le français aux adultes depuis huit ans, avec des méthodes simples et beaucoup de pratique orale. ";
  await page.getByLabel("Titre en anglais").fill("French teacher for busy adults");
  await page.getByLabel("Titre en français").fill("Professeure de français pour adultes pressés");
  await page.getByLabel("À propos de moi, en anglais").fill("I have taught French to adults for eight years, with simple methods and plenty of speaking practice.");
  await page.getByLabel("À propos de moi, en français").fill(bio);
  await page.getByText("Grammaire", { exact: true }).click();
  await saveAndContinue(page, "video");

  // 6. Video
  await page.getByLabel("Ajouter votre vidéo").setInputFiles(file("intro.mp4", "video/mp4", MP4));
  await expect(page.locator("video")).toHaveAttribute("src", /\/api\/files\//);
  await page.getByRole("link", { name: "Disponibilités" }).last().click();

  // 7. Availability: Monday 18:00–20:00
  await page.getByRole("button", { name: "Ajouter des heures" }).first().click();
  await saveAndContinue(page, "pricing");

  // 8. Pricing, with the net amount after the 18% fee
  await page.getByLabel("Prix du cours (FCFA)").fill("5000");
  await expect(page.getByText("Vous recevez 4 100 FCFA par cours")).toBeVisible();
  await page.getByLabel("Prix du cours d'essai (FCFA)").fill("2000");
  await saveAndContinue(page, "identity");

  // 9. Identity: front, back, selfie
  const inputs = page.locator('input[type="file"]');
  await inputs.nth(0).setInputFiles(file("front.png", "image/png", PNG));
  await expect(page.getByText(/Envoyé/)).toHaveCount(1);
  await inputs.nth(1).setInputFiles(file("back.png", "image/png", PNG));
  await expect(page.getByText(/Envoyé/)).toHaveCount(2);
  await inputs.nth(2).setInputFiles(file("selfie.png", "image/png", PNG));
  await expect(page.getByText(/Envoyé/)).toHaveCount(3);
  await saveAndContinue(page, "agreement");
}

async function submit(page: Page, button: string) {
  await expect(page.getByText("Terminez ces étapes avant d'envoyer")).toHaveCount(0);
  for (const label of [/J'accepte les conditions d'utilisation de Learn Quick/, /code de conduite/, /payé après chaque cours/]) {
    await page.getByLabel(label).check();
  }
  await page.getByRole("button", { name: button }).click();
  await expect(page).toHaveURL(/\/fr\/teacher$/);
}

async function decide(page: Page, section: string, decision: "Approuver" | "Demander des modifications", comment?: string) {
  const card = page.locator(`#${section}`);
  await card.getByText(decision, { exact: true }).click();
  if (comment) await card.getByLabel("Commentaire pour l'enseignant").fill(comment);
  await card.getByRole("button", { name: "Enregistrer la décision" }).click();
  await expect(card.getByText(decision === "Approuver" ? "Approuvé" : "Modifications demandées", { exact: true }).first()).toBeVisible();
}

const SECTIONS = ["about", "photo", "certification", "education", "description", "video", "availability", "pricing", "identity"];

test("teacher applies, admin asks for a new photo, teacher fixes it, admin approves", async ({ browser }) => {
  test.skip(!ADMIN.email, "needs a seeded admin");
  test.setTimeout(120_000);
  const teacher = await createUser("TEACHER");
  const tp = await browser.newPage();
  const ap = await browser.newPage();

  // ── Teacher fills in and submits
  await login(tp, teacher.email);
  await fillApplication(tp);
  await submit(tp, "Envoyer ma candidature");
  await expect(tp.getByText("Envoyée — en attente d'examen")).toBeVisible();

  // Nothing can be changed while waiting for review
  await tp.goto("/fr/teacher/application/photo");
  await expect(tp.getByText("Cette partie ne peut pas être modifiée")).toBeVisible();

  // ── Identity files: private, encrypted on disk
  const app = await db.teacherApplication.findFirstOrThrow({ where: { teacher: { userId: teacher.id } } });
  const idUrl = `/api/files/${app.idFrontDocId}`;
  expect((await tp.request.get(idUrl)).status()).toBe(200); // the owner
  const anon = await browser.newContext();
  expect((await anon.request.get(`http://localhost:${process.env.E2E_PORT ?? 3100}${idUrl}`)).status()).toBe(404);
  await anon.close();
  const doc = await db.document.findUniqueOrThrow({ where: { id: app.idFrontDocId! } });
  const onDisk = await readFile(path.join(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage"), doc.storageKey));
  expect(onDisk.includes(PNG.subarray(0, 16))).toBe(false);

  // Another teacher cannot open it either
  const other = await createUser("TEACHER");
  const op = await browser.newPage();
  await login(op, other.email);
  expect((await op.request.get(idUrl)).status()).toBe(404);

  // ── Admin reviews: everything fine except the photo
  await login(ap, ADMIN.email, ADMIN.password, "fr");
  expect((await ap.request.get(idUrl)).status()).toBe(200);
  await ap.goto("/fr/admin/applications");
  await ap.getByRole("link", { name: /Tina Teacher/ }).first().click();
  await ap.getByRole("button", { name: "Commencer l'examen" }).click();
  for (const s of SECTIONS) {
    if (s === "photo") await decide(ap, s, "Demander des modifications", "Votre visage est trop sombre, utilisez une photo prise à la lumière du jour.");
    else await decide(ap, s, "Approuver");
  }
  await ap.getByRole("button", { name: "Envoyer les demandes de modification" }).click();
  await expect.poll(async () => (await db.teacherApplication.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("CHANGES_REQUESTED");

  // ── Teacher sees the comment, can only change the photo, resubmits
  await tp.goto("/fr/teacher");
  await expect(tp.getByText("Modifications demandées")).toBeVisible();
  await tp.getByRole("link", { name: "Continuer ma candidature" }).click();
  await expect(tp).toHaveURL(/\/application\/photo$/);
  await expect(tp.getByText("Votre visage est trop sombre")).toBeVisible();
  const oldPhoto = (await db.teacherProfile.findUniqueOrThrow({ where: { userId: teacher.id } })).photoUrl!;
  await tp.getByLabel("Changer de photo").setInputFiles(file("me2.png", "image/png", PNG));
  await expect.poll(async () => (await db.teacherProfile.findUniqueOrThrow({ where: { userId: teacher.id } })).photoUrl).not.toBe(oldPhoto);
  // The replaced photo file is deleted
  expect(await db.document.findUnique({ where: { id: oldPhoto.split("/").pop()! } })).toBeNull();

  await tp.goto("/fr/teacher/application/about");
  await expect(tp.getByText("Cette section a été approuvée")).toBeVisible();
  await tp.goto("/fr/teacher/application/agreement");
  await submit(tp, "Envoyer mes corrections");

  // ── Admin: earlier approvals are kept; approve the new photo and publish
  await ap.reload();
  await ap.getByRole("button", { name: "Commencer l'examen" }).click();
  await expect(ap.locator("#about").getByText("Approuvé", { exact: true }).first()).toBeVisible();
  await expect(ap.locator("#photo").getByText("Commentaire du tour 1")).toBeVisible();
  await decide(ap, "photo", "Approuver");
  await ap.getByRole("button", { name: "Approuver et publier le profil" }).click();
  await expect(ap.getByText("Approuvée", { exact: true })).toBeVisible();

  // ── Public profile with badges
  const profile = await db.teacherProfile.findUniqueOrThrow({ where: { userId: teacher.id }, include: { badges: true } });
  expect(profile.isPublished).toBe(true);
  expect(profile.badges.map((b) => b.type).sort()).toEqual(["CERTIFIED", "VERIFIED_ID"]);
  const visitor = await browser.newPage();
  await visitor.goto(`/fr/teachers/${profile.id}`);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Tina Teacher");
  await expect(visitor.getByText("Identité vérifiée")).toBeVisible();
  await expect(visitor.getByText("Certifié", { exact: true })).toBeVisible();
  await expect(visitor.getByText("TEFL (120 heures)")).toBeVisible();

  // ID files are scheduled for deletion 90 days after the decision
  const purge = (await db.document.findUniqueOrThrow({ where: { id: app.idFrontDocId! } })).purgeAt!;
  expect(Math.round((purge.getTime() - Date.now()) / 86_400_000)).toBe(90);
  const notifications = await db.notification.findMany({ where: { userId: teacher.id }, orderBy: { createdAt: "asc" } });
  expect(notifications.map((n) => n.type)).toEqual(["APPLICATION_CHANGES_REQUESTED", "APPLICATION_APPROVED"]);
});

test("uploads are checked by content, and texts may not contain contact details", async ({ page }) => {
  const teacher = await createUser("TEACHER");
  await login(page, teacher.email);

  // A web page renamed to .png is refused
  await page.goto("/fr/teacher/application/photo");
  await page.getByLabel("Ajouter une photo").setInputFiles(file("fake.png", "image/png", Buffer.from("<html><script>alert(1)</script></html>")));
  await expect(page.getByText("Ce type de fichier n'est pas accepté.")).toBeVisible();

  await page.goto("/fr/teacher/application/description");
  await page.getByLabel("Titre en anglais").fill("French teacher for busy adults");
  await page.getByLabel("Titre en français").fill("Appelez-moi au 6 77 12 34 56 pour des cours");
  await page.getByLabel("À propos de moi, en anglais").fill("a".repeat(120));
  await page.getByLabel("À propos de moi, en français").fill("b".repeat(120));
  await page.getByText("Grammaire", { exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Retirez les numéros, e-mails, liens ou WhatsApp de ce texte.")).toBeVisible();
  // What the teacher typed is still there
  await expect(page.getByLabel("À propos de moi, en anglais")).toHaveValue("a".repeat(120));
});

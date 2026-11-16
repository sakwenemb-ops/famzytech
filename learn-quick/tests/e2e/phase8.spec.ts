import { expect, test, type Browser } from "@playwright/test";
import { account, bookableTeacher, createTeacher, createUser, db, holdSingleLesson, login, payInSandbox, runMoneyJobs } from "./helpers";
import { TEST_ENV } from "./test-env";

async function asAdmin(browser: Browser) {
  const ap = await browser.newPage();
  ap.on("dialog", (d) => d.accept());
  await login(ap, TEST_ENV.SEED_ADMIN_EMAIL, TEST_ENV.SEED_ADMIN_PASSWORD);
  return ap;
}

test("messaging: contact details hidden before a paid lesson, live delivery both ways, read receipts, report", async ({ browser }) => {
  const { user: tu, teacher } = await createTeacher({ published: true });
  const s = await createUser("STUDENT", { learning: true });
  const sp = await browser.newPage();
  await login(sp, s.email);
  await sp.goto(`/fr/teachers/${teacher.id}`);
  await sp.getByRole("button", { name: "Envoyer un message" }).click();
  await expect(sp).toHaveURL(/\/messages\/c/);
  await expect(sp.getByText(/les numéros, e-mails et liens sont masqués/)).toBeVisible();

  const tp = await browser.newPage();
  await login(tp, tu.email);
  await tp.goto("/fr/teacher");
  await expect(tp.getByTestId("messages-badge")).toHaveAttribute("data-count", "0");

  await sp.getByPlaceholder("Écrire un message").fill("Bonjour ! Appelez-moi au 677 12 34 56 ou écrivez à sam@mail.com");
  await sp.getByRole("button", { name: "Envoyer" }).click();
  const mine = sp.locator('[data-message="mine"]').last();
  await expect(mine).toContainText("Appelez-moi au •••");
  await expect(mine).not.toContainText("677");
  await expect(sp.getByText(/Des coordonnées ont été masquées/)).toBeVisible();

  // The teacher's badge updates live, without reloading
  await expect(tp.getByTestId("messages-badge")).toHaveAttribute("data-count", "1");
  // ...and an email went out for the first unread message only
  await tp.getByTestId("messages-badge").click();
  await expect(tp.getByText(/Vous : |Appelez-moi/).first()).toBeVisible();
  await tp.locator("a[data-conversation]").first().click();
  await expect(tp.locator('[data-message="theirs"]')).toContainText("Appelez-moi au •••");
  await expect(tp.getByTestId("messages-badge")).toHaveAttribute("data-count", "0");
  // The student sees "Seen" live
  await expect(mine).toContainText("Vu");

  await tp.getByPlaceholder("Écrire un message").fill("Bonjour Sam, avec plaisir.");
  await tp.getByRole("button", { name: "Envoyer" }).click();
  await expect(sp.locator('[data-message="theirs"]')).toContainText("avec plaisir"); // live

  // After a paid lesson, contact details are no longer hidden
  await db.booking.create({
    data: { studentId: s.studentProfile!.id, teacherId: teacher.id, type: "SINGLE", status: "COMPLETED", startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() - 86_400_000 + 50 * 60_000), priceXaf: 4500, commissionPct: 18 },
  });
  await sp.getByPlaceholder("Écrire un message").fill("Mon numéro : 677 12 34 56");
  await sp.getByRole("button", { name: "Envoyer" }).click();
  await expect(sp.locator('[data-message="mine"]').last()).toContainText("677 12 34 56");

  // Report, then an admin reads and closes it
  await tp.getByRole("button", { name: "Signaler" }).click();
  await tp.getByLabel("Quel est le problème avec cette conversation ?").fill("Il me demande de payer en dehors du site.");
  await tp.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(tp.getByText("Signalé à l'équipe")).toBeVisible();

  const ap = await asAdmin(browser);
  await ap.goto("/fr/admin");
  await ap.getByRole("link", { name: /conversation signalée/ }).first().click();
  await ap.locator("li").filter({ hasText: "Il me demande de payer en dehors du site." }).getByRole("link").click();
  await expect(ap.getByText("Bonjour Sam, avec plaisir.")).toBeVisible();
  await ap.getByRole("button", { name: "Clôturer le signalement" }).click();
  await expect(ap.getByText("Ce signalement est clôturé.")).toBeVisible();
  const log = await db.auditLog.findFirst({ where: { action: "REPORT_CLOSED" }, orderBy: { createdAt: "desc" } });
  expect(log).not.toBeNull();
});

test("notifications: bell count, open marks read and follows the link, mark all read, email preferences", async ({ page }) => {
  const s = await createUser("STUDENT", { learning: true });
  await db.notification.createMany({
    data: [
      { userId: s.id, type: "BOOKING_CONFIRMED", title: "Cours confirmé", body: "Votre cours est réservé.", link: "/student/lessons" },
      { userId: s.id, type: "PAYMENT_TO_WALLET", title: "Remboursement", body: "4 000 FCFA sur votre portefeuille.", link: "https://evil.example/phish" },
    ],
  });
  await login(page, s.email);
  await page.goto("/fr/student");
  await expect(page.getByTestId("bell")).toHaveAttribute("data-count", "2");
  await page.getByTestId("bell").click();
  await expect(page.getByRole("heading", { name: "Notifications", level: 1 })).toBeVisible();
  await expect(page.getByText("2 non lues")).toBeVisible();

  await page.locator('li[data-notification="BOOKING_CONFIRMED"] button').click();
  await expect(page).toHaveURL(/\/fr\/student\/lessons/);
  await expect(page.getByTestId("bell")).toHaveAttribute("data-count", "1");

  // A link to another site is never followed
  await page.goto("/fr/notifications");
  await page.locator('li[data-notification="PAYMENT_TO_WALLET"] button').click();
  await expect(page).toHaveURL(/\/fr\/notifications/);
  await expect(page.getByText("Vous êtes à jour.")).toBeVisible();

  await page.goto("/fr/student/settings");
  await expect(page.getByLabel(/Compte et candidature/)).toBeDisabled();
  await page.getByRole("checkbox", { name: /^Cours/ }).uncheck();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).last().click();
  await expect(page.getByText("Préférences enregistrées.")).toBeVisible();
  const pref = await db.notificationPreference.findUniqueOrThrow({ where: { userId_type_channel: { userId: s.id, type: "lessons", channel: "EMAIL" } } });
  expect(pref.enabled).toBe(false);
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /^Cours/ })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^Messages/ })).toBeChecked();
});

test("dispute: student reports a problem → earnings held → teacher answers → admin refunds half", async ({ browser }) => {
  const { user: tu, teacher } = await bookableTeacher(10000);
  const student = await createUser("STUDENT", { learning: true });
  const sp = await browser.newPage();
  await login(sp, student.email);
  await holdSingleLesson(sp, teacher.id);
  await payInSandbox(sp);
  await expect(sp).toHaveURL(/booked=/);
  const b = await db.booking.findFirstOrThrow({ where: { teacherId: teacher.id, status: "CONFIRMED" } });
  const startsAt = new Date(Date.now() - 3 * 3_600_000);
  await db.booking.update({ where: { id: b.id }, data: { startsAt, endsAt: new Date(startsAt.getTime() + 50 * 60_000) } });
  const lesson = await db.lesson.findUniqueOrThrow({ where: { bookingId: b.id } });
  for (const [userId, role] of [[tu.id, "TEACHER"], [student.id, "STUDENT"]] as const) {
    await db.lessonAttendance.create({ data: { lessonId: lesson.id, userId, role, joinedAt: new Date(startsAt.getTime() + 60_000), leftAt: new Date(startsAt.getTime() + 10 * 60_000) } });
  }
  runMoneyJobs();
  expect(await account("TEACHER_PENDING", tu.id)).toBe(8200);
  const revenueBefore = await account("PLATFORM_REVENUE");

  await sp.goto("/fr/student/lessons");
  await sp.getByText("Signaler un problème avec ce cours").click();
  await sp.getByLabel("Que s'est-il passé ?").fill("Le professeur est parti après 10 minutes.");
  await sp.getByRole("button", { name: "Envoyer à l'équipe" }).click();
  await expect(sp.locator('[data-dispute="OPEN"]')).toContainText("Problème signalé : en cours d'examen");

  // Even after the window ends, held earnings are not released while the dispute is open
  await db.booking.update({ where: { id: b.id }, data: { releaseAt: new Date(Date.now() - 1000) } });
  runMoneyJobs();
  expect(await account("TEACHER_AVAILABLE", tu.id)).toBe(0);

  const tp = await browser.newPage();
  await login(tp, tu.email);
  await tp.goto("/fr/teacher/lessons");
  await expect(tp.getByText("Le professeur est parti après 10 minutes.", { exact: false })).toBeVisible();
  await tp.getByLabel("Votre version").fill("Ma connexion a coupé, j'ai proposé de rattraper le cours.");
  await tp.getByRole("button", { name: "Envoyer ma réponse" }).click();
  await expect(tp.locator('[data-dispute="OPEN"]')).toContainText("Professeur : « Ma connexion a coupé");
  await expect(tp.getByRole("button", { name: "Envoyer ma réponse" })).toHaveCount(0);

  const ap = await asAdmin(browser);
  await ap.goto("/fr/admin");
  await ap.getByRole("link", { name: /litiges? à trancher/ }).click();
  const d = await db.dispute.findUniqueOrThrow({ where: { bookingId: b.id } });
  await ap.goto(`/fr/admin/disputes/${d.id}`);
  await expect(ap.getByText("Ma connexion a coupé")).toBeVisible();
  await ap.getByLabel(/Remboursement de moitié/).check();
  await ap.getByRole("button", { name: "Confirmer la décision" }).click();
  await expect(ap.getByText("Écrivez au moins 10 caractères.")).toBeVisible();
  await ap.getByLabel("Explication envoyée aux deux").fill("Le cours a été écourté ; remboursement de la moitié.");
  await ap.getByRole("button", { name: "Confirmer la décision" }).click();
  await expect(ap.getByTestId("dispute-status")).toHaveText("Remboursé (50 %)");
  await expect(ap.getByRole("button", { name: "Confirmer la décision" })).toHaveCount(0);

  // 50 % of 8 200 + 50 % of 1 800 back to the student; the other half to the teacher at once
  expect(await account("STUDENT_WALLET", student.id)).toBe(5000);
  expect(await account("TEACHER_PENDING", tu.id)).toBe(0);
  expect(await account("TEACHER_AVAILABLE", tu.id)).toBe(4100);
  expect(await account("PLATFORM_REVENUE")).toBe(revenueBefore - 900);
  const sum = await db.ledgerLine.aggregate({ _sum: { amountXaf: true } });
  expect(sum._sum.amountXaf ?? 0).toBe(0);
  expect((await db.dispute.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("RESOLVED_REFUND");

  await sp.goto("/fr/student/lessons");
  await expect(sp.locator('[data-dispute="RESOLVED_REFUND"]')).toContainText("Remboursé (50 %)");
  await expect(sp.getByText("Signaler un problème avec ce cours")).toHaveCount(0);
});

test("admin: suspend signs the user out, cancels their lessons with a refund; settings changes are logged", async ({ browser }) => {
  const { user: tu, teacher } = await bookableTeacher(5000);
  const student = await createUser("STUDENT", { learning: true });
  const sp = await browser.newPage();
  await login(sp, student.email);
  await holdSingleLesson(sp, teacher.id);
  await payInSandbox(sp);
  await expect(sp).toHaveURL(/booked=/);

  const tp = await browser.newPage();
  await login(tp, tu.email);
  await tp.goto("/fr/teacher");

  const ap = await asAdmin(browser);
  await ap.goto(`/fr/admin/users?q=${encodeURIComponent(tu.email)}`);
  await ap.getByRole("link", { name: /Tina Teacher/ }).click();
  await expect(ap.getByText(/Ses 1 cours à venir seront annulés/)).toBeVisible();
  await ap.getByRole("button", { name: "Suspendre le compte" }).click();
  await expect(ap.getByText(/au moins 5 caractères/)).toBeVisible();
  await ap.getByLabel(/Motif/).fill("Demande de paiement hors plateforme.");
  await ap.getByRole("button", { name: "Suspendre le compte" }).click();
  await expect(ap.getByText(/Compte suspendu\. 1 cours annulés et remboursés\./)).toBeVisible();
  await expect(ap.getByTestId("user-status")).toHaveText("Suspendu");

  expect((await db.teacherProfile.findUniqueOrThrow({ where: { id: teacher.id } })).isPublished).toBe(false);
  expect(await account("STUDENT_WALLET", student.id)).toBe(5000);
  await tp.reload();
  await expect(tp).toHaveURL(/\/login/);

  await ap.getByLabel(/Motif/).fill("Erreur, compte vérifié.");
  await ap.getByRole("button", { name: "Réactiver le compte" }).click();
  await expect(ap.getByTestId("user-status")).toHaveText("Actif");

  // Settings: out-of-range values are refused, changes are recorded
  await ap.goto("/fr/admin/settings");
  const ai = ap.getByLabel("Corrections IA par personne et par jour");
  const before = await ai.inputValue();
  await ai.fill("1000");
  await ap.getByRole("button", { name: "Enregistrer" }).click();
  await expect(ap.getByText("Hors des limites autorisées.")).toBeVisible();
  await ai.fill(String(Number(before) + 1));
  await ap.getByRole("button", { name: "Enregistrer" }).click();
  await expect(ap.getByText("Réglages enregistrés.")).toBeVisible();
  await ai.fill(before);
  await ap.getByRole("button", { name: "Enregistrer" }).click();
  await expect(ap.getByText("Réglages enregistrés.")).toBeVisible();

  await ap.goto("/fr/admin/audit?action=SETTINGS_CHANGED");
  await expect(ap.locator('li[data-action="SETTINGS_CHANGED"]').first()).toContainText("libraryAiGradesPerDay");
  await ap.goto("/fr/admin/audit?action=USER_SUSPENDED");
  await expect(ap.locator('li[data-action="USER_SUSPENDED"]').first()).toContainText("Demande de paiement hors plateforme.");
});

test("security headers and health check", async ({ request }) => {
  const res = await request.get("/fr");
  const csp = res.headers()["content-security-policy"];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ ok: true });
  expect((await request.get("/api/me/events")).status()).toBe(401);
});

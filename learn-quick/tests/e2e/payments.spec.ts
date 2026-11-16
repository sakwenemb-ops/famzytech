import { expect, test } from "@playwright/test";
import { account, bookableTeacher, createUser, db, holdSingleLesson, login, payInSandbox, runMoneyJobs } from "./helpers";
import { TEST_ENV } from "./test-env";

async function ledgerBalanced() {
  const sum = await db.ledgerLine.aggregate({ _sum: { amountXaf: true } });
  expect(sum._sum.amountXaf ?? 0).toBe(0);
}

test("declined, then approved: the lesson is booked, the money is held, and a receipt exists", async ({ page }) => {
  const { teacher } = await bookableTeacher(5000);
  const student = await createUser("STUDENT", { learning: true });
  await login(page, student.email);
  await holdSingleLesson(page, teacher.id);

  // A Nexttel number can't pay
  await page.getByLabel("Numéro Mobile Money").fill("660000000");
  await expect(page.getByText("Seuls les numéros MTN et Orange Cameroun peuvent payer.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Payer / })).toBeDisabled();

  // MTN number: declined on the phone
  await payInSandbox(page, { decline: true });
  await expect(page.getByText("Le paiement a été refusé ou annulé sur le téléphone.")).toBeVisible();

  // Orange number: approved
  await payInSandbox(page, { phone: "690000001" });
  await expect(page).toHaveURL(/\/student\/lessons\?booked=/);

  const booking = await db.booking.findFirstOrThrow({ where: { teacherId: teacher.id } });
  expect(booking.status).toBe("CONFIRMED");
  const payments = await db.payment.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: "asc" } });
  expect(payments.map((p) => [p.status, p.operator])).toEqual([["FAILED", "MTN"], ["SUCCESSFUL", "ORANGE"]]);
  expect(booking.paymentId).toBe(payments[1].id);
  // This payment's own ledger entry: 5 000 from Mobile Money into escrow (other tests run in parallel)
  const entry = await db.ledgerTransaction.findUniqueOrThrow({ where: { kind_referenceId: { kind: "PAYMENT_IN", referenceId: payments[1].id } }, include: { lines: true } });
  expect(entry.lines.map((l) => [l.accountId, l.amountXaf]).sort()).toEqual([["platform_external", -5000], ["platform_platform_clearing", 5000]]);
  await ledgerBalanced();

  await page.goto(`/fr/receipts/${payments[1].id}`);
  await expect(page.getByRole("heading", { name: "Reçu de paiement" })).toBeVisible();
  await expect(page.getByText("5 000 FCFA")).toBeVisible();
  await expect(page.getByText(/Orange Money · \+237690000001/)).toBeVisible();
});

test("a forged webhook can't confirm a payment: the app always asks the provider", async ({ page, request }) => {
  const { teacher } = await bookableTeacher(5000);
  const student = await createUser("STUDENT", { learning: true });
  await login(page, student.email);
  await holdSingleLesson(page, teacher.id);
  await page.getByLabel("Numéro Mobile Money").fill("670000002");
  await page.getByRole("button", { name: /^Payer / }).click();
  await expect(page.getByText("Validez le paiement sur votre téléphone")).toBeVisible();

  const payment = await db.payment.findFirstOrThrow({ where: { userId: student.id, status: "PENDING" } });
  // Someone claims the payment succeeded, for a big amount
  const res = await request.get(`/api/webhooks/campay?reference=${payment.providerRef}&status=SUCCESSFUL&amount=999999&signature=fake`);
  expect(res.status()).toBe(200);
  expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
  expect((await db.booking.findFirstOrThrow({ where: { teacherId: teacher.id } })).status).toBe("HELD");
  expect(await db.webhookEvent.count({ where: { paymentId: payment.id } })).toBe(1);
});

test("teacher cancels: refund to the wallet; the wallet pays the next lesson", async ({ browser }) => {
  const { user: tu, teacher } = await bookableTeacher(4000);
  const student = await createUser("STUDENT", { learning: true });
  const sp = await browser.newPage();
  await login(sp, student.email);
  await holdSingleLesson(sp, teacher.id);
  await payInSandbox(sp);
  await expect(sp).toHaveURL(/booked=/);

  const tp = await browser.newPage();
  tp.on("dialog", (d) => d.accept());
  await login(tp, tu.email);
  await tp.goto("/fr/teacher/lessons");
  await tp.getByRole("button", { name: "Annuler" }).click();
  await expect(tp.getByText("Annulé par l'enseignant")).toBeVisible();
  await expect.poll(() => account("STUDENT_WALLET", student.id)).toBe(4000);

  await sp.goto("/fr/student/wallet");
  await expect(sp.getByText("4 000 FCFA").first()).toBeVisible();
  await expect(sp.getByText("Remboursement d'un cours annulé")).toBeVisible();

  // Pay the next lesson with the wallet, no phone needed
  await holdSingleLesson(sp, teacher.id, true);
  await sp.getByRole("button", { name: /Payer avec mon portefeuille \(4 000 FCFA\)/ }).click();
  await expect(sp).toHaveURL(/booked=/);
  expect(await account("STUDENT_WALLET", student.id)).toBe(0);
  await ledgerBalanced();
});

test("lesson happens → teacher pending → available after 24 h → payout approved and sent", async ({ browser }) => {
  const { user: tu, teacher } = await bookableTeacher(10000);
  const student = await createUser("STUDENT", { learning: true });
  const sp = await browser.newPage();
  await login(sp, student.email);
  await holdSingleLesson(sp, teacher.id);
  await payInSandbox(sp);
  await expect(sp).toHaveURL(/booked=/);

  // The lesson took place yesterday (moved into the past for the test)
  const b = await db.booking.findFirstOrThrow({ where: { teacherId: teacher.id, status: "CONFIRMED" } });
  const startsAt = new Date(Date.now() - 3 * 3_600_000);
  await db.booking.update({ where: { id: b.id }, data: { startsAt, endsAt: new Date(startsAt.getTime() + 50 * 60_000) } });
  // Both joined the classroom
  const lesson = await db.lesson.findUniqueOrThrow({ where: { bookingId: b.id } });
  for (const [userId, role] of [[tu.id, "TEACHER"], [student.id, "STUDENT"]] as const) {
    await db.lessonAttendance.create({ data: { lessonId: lesson.id, userId, role, joinedAt: new Date(startsAt.getTime() + 60_000), leftAt: new Date(startsAt.getTime() + 49 * 60_000) } });
  }
  runMoneyJobs();
  expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("COMPLETED");
  expect(await account("TEACHER_PENDING", tu.id)).toBe(8200); // 10 000 − 18 %
  const earned = await db.ledgerTransaction.findUniqueOrThrow({ where: { kind_referenceId: { kind: "LESSON_EARNED", referenceId: b.id } }, include: { lines: true } });
  expect(earned.lines.find((l) => l.accountId === "platform_platform_revenue")?.amountXaf).toBe(1800);

  // Not released before the dispute window ends; released after
  runMoneyJobs();
  expect(await account("TEACHER_AVAILABLE", tu.id)).toBe(0);
  await db.booking.update({ where: { id: b.id }, data: { releaseAt: new Date(Date.now() - 1000) } });
  runMoneyJobs();
  expect(await account("TEACHER_PENDING", tu.id)).toBe(0);
  expect(await account("TEACHER_AVAILABLE", tu.id)).toBe(8200);

  // The teacher asks for a payout: password required
  const tp = await browser.newPage();
  await login(tp, tu.email);
  await tp.goto("/fr/teacher/earnings");
  await expect(tp.getByText("8 200 FCFA").first()).toBeVisible();
  await tp.getByLabel("Numéro Mobile Money").fill("677000000");
  await tp.getByLabel("Votre mot de passe").fill("wrongpass1");
  await tp.getByRole("button", { name: "Retirer" }).click();
  await expect(tp.getByText("Votre mot de passe actuel n'est pas correct.")).toBeVisible();
  await tp.getByLabel("Votre mot de passe").fill("secret123");
  await tp.getByRole("button", { name: "Retirer" }).click();
  await expect(tp.getByText("Votre demande de retrait a été envoyée.")).toBeVisible();
  expect(await account("TEACHER_AVAILABLE", tu.id)).toBe(0); // set aside at once: can't be spent twice

  // Admin approves; the sandbox sends it at once
  const ap = await browser.newPage();
  await login(ap, TEST_ENV.SEED_ADMIN_EMAIL, TEST_ENV.SEED_ADMIN_PASSWORD);
  await ap.goto("/fr/admin/payments");
  await expect(ap.getByText("Comptabilité équilibrée")).toBeVisible();
  const payout = await db.payout.findFirstOrThrow({ where: { userId: tu.id } });
  const row = ap.locator(`li[data-payout="${payout.id}"]`);
  await expect(row).toContainText("8 200 FCFA");
  await row.getByRole("button", { name: "Approuver et envoyer" }).click();
  await expect.poll(async () => (await db.payout.findFirstOrThrow({ where: { userId: tu.id } })).status).toBe("PAID");
  expect(await db.notification.count({ where: { userId: tu.id, type: "PAYOUT_PAID" } })).toBe(1);
  await ledgerBalanced();
});

test("a student cancelling too late pays the teacher, not the wallet", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const { user: tu, teacher } = await bookableTeacher(6000);
  const student = await createUser("STUDENT", { learning: true });
  await login(page, student.email);
  await holdSingleLesson(page, teacher.id); // first free time: about 6–7 hours from now
  await payInSandbox(page);
  await expect(page).toHaveURL(/booked=/);
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByText("Annulé par l'élève")).toBeVisible();
  expect(await account("STUDENT_WALLET", student.id)).toBe(0);
  expect(await account("TEACHER_PENDING", tu.id)).toBe(4920); // 6 000 − 18 %
  await ledgerBalanced();
});

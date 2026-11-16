import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createTeacher, createUser, db, login } from "./helpers";
import { TEST_ENV } from "./test-env";

const runMoneyJobs = () => execSync("npm run -s jobs:money", { env: { ...process.env, ...TEST_ENV }, stdio: "pipe" });

/** A confirmed lesson starting `inMinutes` from now (the classroom opens 10 minutes before). */
async function lessonSoon(inMinutes = 5) {
  const { user: teacherUser, teacher } = await createTeacher({ published: true });
  const student = await createUser("STUDENT", { learning: true });
  const sp = await db.studentProfile.findUniqueOrThrow({ where: { userId: student.id } });
  const startsAt = new Date(Date.now() + inMinutes * 60_000);
  const booking = await db.booking.create({
    data: {
      studentId: sp.id,
      teacherId: teacher.id,
      type: "SINGLE",
      status: "CONFIRMED",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 50 * 60_000),
      priceXaf: 5000,
      commissionPct: 18,
      lesson: { create: { roomName: `lq-${randomUUID()}` } },
    },
  });
  return { teacherUser, teacher, student, booking };
}

async function joinRoom(page: Page, bookingId: string) {
  await page.goto(`/fr/lesson/${bookingId}`);
  await expect(page.getByRole("heading", { name: "Vérifiez votre caméra et votre micro" })).toBeVisible();
  // The fake camera shows in the preview
  await expect.poll(() => page.getByTestId("preview-video").evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Rejoindre le cours", exact: true }).click();
}

const remoteVideoWidth = (page: Page) => page.getByTestId("remote-video").evaluate((v: HTMLVideoElement) => v.videoWidth);

test("teacher and student meet: video, chat, whiteboard, notes, then the lesson counts", async ({ browser }) => {
  test.setTimeout(120_000);
  const { teacherUser, teacher, student, booking } = await lessonSoon();
  const tp = await browser.newPage();
  const sp = await browser.newPage();
  await login(tp, teacherUser.email);
  await login(sp, student.email);

  // The lessons page shows a Join button (the room is open)
  await sp.goto("/fr/student/lessons");
  await expect(sp.getByRole("link", { name: "Rejoindre le cours" })).toHaveAttribute("href", `/fr/lesson/${booking.id}`);

  // Teacher first, then student: they connect and see each other's camera
  await joinRoom(tp, booking.id);
  await expect(tp.getByText("En attente de Sam Student…")).toBeVisible();
  await joinRoom(sp, booking.id);
  await expect.poll(() => remoteVideoWidth(sp), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect.poll(() => remoteVideoWidth(tp), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect(sp.getByTestId("quality")).toBeVisible();

  // Chat
  await sp.getByLabel("Écrire un message…").fill("Bonjour, je suis prêt !");
  await sp.getByRole("button", { name: "Envoyer" }).click();
  await expect(tp.getByTestId("chat-list")).toContainText("Bonjour, je suis prêt !");

  // Whiteboard: the teacher draws, the student's board shows it, and it is saved
  await tp.getByRole("tab", { name: "Tableau" }).click();
  await sp.getByRole("tab", { name: "Tableau" }).click();
  const board = tp.getByTestId("whiteboard");
  const box = (await board.boundingBox())!;
  await tp.mouse.move(box.x + 30, box.y + 30);
  await tp.mouse.down();
  for (let i = 1; i <= 10; i++) await tp.mouse.move(box.x + 30 + i * 15, box.y + 30 + i * 8);
  await tp.mouse.up();
  await expect
    .poll(async () => ((await db.lesson.findUniqueOrThrow({ where: { bookingId: booking.id } })).whiteboardState as { strokes: unknown[] } | null)?.strokes.length ?? 0)
    .toBe(1);
  const inkOnStudentBoard = () =>
    sp.getByTestId("whiteboard").evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let ink = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 200) ink++;
      return ink;
    });
  await expect.poll(inkOnStudentBoard).toBeGreaterThan(20);

  // Shared notes
  await sp.getByRole("tab", { name: "Notes" }).click();
  await tp.getByRole("tab", { name: "Notes" }).click();
  await sp.getByRole("textbox", { name: "Notes" }).fill("Le passé composé avec être");
  await expect(tp.getByRole("textbox", { name: "Notes" })).toHaveValue("Le passé composé avec être");

  // Data saving: the teacher switches to audio only; the student is told
  await tp.getByRole("button", { name: "Audio seul (économise les données)" }).click();
  await expect(sp.getByText("Tina Teacher est passé en audio seul.")).toBeVisible();

  // Attendance was recorded for both
  const lesson = await db.lesson.findUniqueOrThrow({ where: { bookingId: booking.id }, include: { attendance: true } });
  expect(new Set(lesson.attendance.map((a) => a.userId))).toEqual(new Set([teacherUser.id, student.id]));
  await tp.getByRole("button", { name: "Quitter" }).click();
  await expect(tp).toHaveURL(/\/fr\/teacher\/lessons$/);
  await expect.poll(async () => (await db.lessonAttendance.findFirstOrThrow({ where: { lessonId: lesson.id, userId: teacherUser.id } })).leftAt).not.toBeNull();
  await sp.close();

  // Later: the lesson is over (moved into the past for the test) and settled from attendance
  const startsAt = new Date(Date.now() - 2 * 3_600_000);
  await db.booking.update({ where: { id: booking.id }, data: { startsAt, endsAt: new Date(startsAt.getTime() + 50 * 60_000) } });
  await db.lessonAttendance.updateMany({ where: { lessonId: lesson.id }, data: { joinedAt: new Date(startsAt.getTime() + 60_000), leftAt: new Date(startsAt.getTime() + 50 * 60_000) } });
  runMoneyJobs();
  expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("COMPLETED");

  // The teacher writes notes and homework; the student sees them and leaves a review
  await tp.goto("/fr/teacher/lessons");
  await tp.getByLabel("Ce que vous avez travaillé").fill("Passé composé : être ou avoir.");
  await tp.getByLabel("Devoirs").fill("Écrire 10 phrases au passé composé.");
  await tp.getByRole("button", { name: "Enregistrer et envoyer à l'élève" }).click();
  await expect(tp.getByText("Enregistré et envoyé à l'élève.")).toBeVisible();

  const sp2 = await browser.newPage();
  await login(sp2, student.email);
  await sp2.goto("/fr/student/lessons");
  await expect(sp2.getByText("Écrire 10 phrases au passé composé.")).toBeVisible();
  await sp2.getByRole("button", { name: "Envoyer mon avis" }).click();
  await expect(sp2.getByText("Choisissez un nombre d'étoiles.")).toBeVisible();
  await sp2.getByRole("radio", { name: "4 étoiles" }).click();
  await sp2.getByLabel("Votre avis (facultatif)").fill("Très claire et patiente.");
  await sp2.getByRole("button", { name: "Envoyer mon avis" }).click();
  // The form is replaced by the student's own rating
  await expect(sp2.getByText("Votre avis : ★★★★☆")).toBeVisible();
  const t = await db.teacherProfile.findUniqueOrThrow({ where: { id: teacher.id } });
  expect([t.ratingAvg, t.ratingCount, t.lessonsCompleted]).toEqual([4, 1, 1]);

  // The lesson record keeps the chat, notes and homework
  await sp2.goto(`/fr/lesson/${booking.id}`);
  await expect(sp2.getByRole("heading", { name: "Compte rendu du cours" })).toBeVisible();
  await expect(sp2.getByText("Bonjour, je suis prêt !")).toBeVisible();
  await expect(sp2.getByText("Le passé composé avec être")).toBeVisible();
});

test("only the lesson's student and teacher can enter; the room opens 10 minutes before", async ({ browser }) => {
  const { booking, student } = await lessonSoon(2 * 24 * 60); // in two days
  const sp = await browser.newPage();
  await login(sp, student.email);
  await sp.goto(`/fr/lesson/${booking.id}`);
  await expect(sp.getByText(/La salle de cours ouvre 10 minutes avant le cours/)).toBeVisible();
  expect((await sp.request.get(`/api/lessons/${booking.id}/events`)).status()).toBe(404);

  const stranger = await createUser("STUDENT", { learning: true });
  const op = await browser.newPage();
  await login(op, stranger.email);
  expect((await op.goto(`/fr/lesson/${booking.id}`))?.status()).toBe(404);
});

test("the teacher doesn't show up: the student is refunded", async ({ page }) => {
  const { booking, student } = await lessonSoon();
  // Paid by the student's wallet beforehand (refund will go back to it)
  await db.booking.update({ where: { id: booking.id }, data: { status: "HELD", holdExpiresAt: new Date(Date.now() + 600_000) } });
  // A balanced top-up of 5 000 FCFA into the student's wallet (outside world → wallet)
  const wallet = await db.ledgerAccount.create({ data: { userId: student.id, type: "STUDENT_WALLET", balanceXaf: 5000 } });
  await db.ledgerTransaction.create({
    data: {
      kind: "TEST_TOPUP",
      referenceId: booking.id,
      lines: { create: [{ accountId: "platform_external", amountXaf: -5000 }, { accountId: wallet.id, amountXaf: 5000 }] },
    },
  });
  await db.ledgerAccount.update({ where: { id: "platform_external" }, data: { balanceXaf: { decrement: 5000 } } });
  await login(page, student.email);
  await page.goto(`/fr/checkout/${booking.id}`);
  await page.getByRole("button", { name: /Payer avec mon portefeuille/ }).click();
  await expect(page).toHaveURL(/booked=/);

  // Only the student joins
  await joinRoom(page, booking.id);
  await expect(page.getByText("En attente de Tina Teacher…")).toBeVisible();
  const lesson = await db.lesson.findUniqueOrThrow({ where: { bookingId: booking.id } });
  await expect.poll(() => db.lessonAttendance.count({ where: { lessonId: lesson.id } })).toBe(1);

  const startsAt = new Date(Date.now() - 2 * 3_600_000);
  await db.booking.update({ where: { id: booking.id }, data: { startsAt, endsAt: new Date(startsAt.getTime() + 50 * 60_000) } });
  await db.lessonAttendance.updateMany({ where: { lessonId: lesson.id }, data: { joinedAt: new Date(startsAt.getTime() + 60_000) } });
  runMoneyJobs();
  expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("NO_SHOW_TEACHER");
  expect((await db.ledgerAccount.findUniqueOrThrow({ where: { userId_type: { userId: student.id, type: "STUDENT_WALLET" } } })).balanceXaf).toBe(5000);
  await page.goto("/fr/student/lessons");
  await expect(page.getByText("L'enseignant ne s'est pas connecté. Vous avez été remboursé.")).toBeVisible();
});

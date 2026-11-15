import { expect, test, type Page } from "@playwright/test";
import { createTeacher, createUser, db, login, payInSandbox } from "./helpers";

/** A published teacher who teaches every day, all day (Douala time), with a unique price for filtering. */
async function bookableTeacher(price: number, opts: { trial?: number; pack5?: number; hours?: [number, number] } = {}) {
  const { user, teacher } = await createTeacher({ published: true });
  const [start, end] = opts.hours ?? [0, 1440];
  await db.teacherProfile.update({
    where: { id: teacher.id },
    data: {
      hourlyRateXaf: price,
      trialRateXaf: opts.trial ?? Math.round(price / 2),
      package5Discount: opts.pack5 ?? 10,
      availability: { create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: start, endMin: end })) },
    },
  });
  return { user, teacher };
}

const firstSlot = (page: Page) => page.locator("button[data-slot]").first();

async function pickSlotAndContinue(page: Page, option: RegExp) {
  await firstSlot(page).click();
  await page.getByRole("radio", { name: option }).check();
  await page.getByRole("button", { name: /^(Continuer|Réserver ce cours)$/ }).click();
}

test("catalogue filters by language, price and time of day", async ({ page }) => {
  const price = 4000 + Math.floor(Math.random() * 999);
  const { teacher } = await bookableTeacher(price, { hours: [6 * 60, 12 * 60] }); // mornings only
  const range = `priceMin=${price}&priceMax=${price}`;

  await page.goto(`/fr/teachers?${range}`);
  await expect(page.getByText("1 enseignant", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tina Teacher" })).toHaveAttribute("href", `/fr/teachers/${teacher.id}`);

  await page.goto(`/fr/teachers?${range}&subject=ENGLISH`);
  await expect(page.getByText("Aucun enseignant ne correspond", { exact: true })).toBeVisible();

  await page.goto(`/fr/teachers?${range}&time=morning`);
  await expect(page.getByText("1 enseignant", { exact: true })).toBeVisible();
  await page.goto(`/fr/teachers?${range}&time=evening`);
  await expect(page.getByText("Aucun enseignant ne correspond", { exact: true })).toBeVisible();
});

test("student books a trial lesson, pays (simulated) and both sides see it", async ({ browser }) => {
  const { user: tu, teacher } = await bookableTeacher(6000, { trial: 2500 });
  const student = await createUser("STUDENT", { learning: true });
  const page = await browser.newPage();
  await login(page, student.email);

  await page.goto(`/fr/teachers/${teacher.id}`);
  await expect(page.getByRole("radio")).toHaveCount(0); // options appear after choosing a time
  await firstSlot(page).click();
  await expect(page.getByRole("radio", { name: /Cours d'essai/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /5 cours.*−10 %.*27 000 FCFA/ })).toBeVisible(); // 6 000 × 0.9 × 5
  await page.getByRole("radio", { name: /Cours d'essai/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/fr\/checkout\//);
  await expect(page.getByText("2 500 FCFA", { exact: true })).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/réservé pendant 1[45]:/);
  await payInSandbox(page);

  await expect(page).toHaveURL(/\/fr\/student\/lessons\?booked=/);
  await expect(page.getByText("Votre cours est réservé !")).toBeVisible();
  await expect(page.getByText(/Essai avec Tina Teacher/)).toBeVisible();

  // Calendar file: the student can download it, a stranger cannot
  const booking = await db.booking.findFirstOrThrow({ where: { teacherId: teacher.id }, include: { lesson: true } });
  expect(booking.status).toBe("CONFIRMED");
  expect(booking.lesson?.roomName).toMatch(/^lq-/);
  const ics = await page.request.get(`/api/bookings/${booking.id}/ics`);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain("BEGIN:VEVENT");

  // The teacher sees the lesson and was notified
  const tp = await browser.newPage();
  await login(tp, tu.email);
  await tp.goto("/fr/teacher/lessons");
  await expect(tp.getByText(/Essai avec Sam Student/)).toBeVisible();
  expect((await tp.request.get(`/api/bookings/${booking.id}/ics`)).status()).toBe(200);
  const other = await createUser("STUDENT");
  const op = await browser.newPage();
  await login(op, other.email);
  expect((await op.request.get(`/api/bookings/${booking.id}/ics`)).status()).toBe(404);
  expect(await db.notification.count({ where: { userId: tu.id, type: "BOOKING_CONFIRMED" } })).toBe(1);

  // The trial is used and the booked time is no longer offered
  await page.goto(`/fr/teachers/${teacher.id}`);
  await firstSlot(page).click();
  await expect(page.getByRole("radio", { name: /Cours d'essai/ })).toHaveCount(0);
  const slotTimes = await page.locator("button[data-slot]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const bookedLabel = new Intl.DateTimeFormat("fr", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" }).format(booking.startsAt);
  const bookedDay = new Intl.DateTimeFormat("fr", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(booking.startsAt)}T12:00:00Z`),
  );
  expect(slotTimes).not.toContain(`${bookedDay} ${bookedLabel}`);
});

test("a pack of 5: pay once, book with credits, cancel gives the credit back", async ({ page }) => {
  const { teacher } = await bookableTeacher(5000, { pack5: 20 });
  const student = await createUser("STUDENT", { learning: true });
  await login(page, student.email);

  await page.goto(`/fr/teachers/${teacher.id}`);
  await pickSlotAndContinue(page, /5 cours/);
  await expect(page.getByText("20 000 FCFA", { exact: true })).toBeVisible(); // 5 000 × 0.8 × 5
  await payInSandbox(page);
  await expect(page.getByText("Tina Teacher : 4 cours restants sur 5")).toBeVisible();

  // Second lesson, next week, uses a credit: confirmed at once, no checkout
  await page.goto(`/fr/teachers/${teacher.id}`);
  await expect(firstSlot(page)).toBeVisible();
  await page.getByRole("button", { name: "Plus tard" }).click();
  await firstSlot(page).click();
  await expect(page.getByRole("radio", { name: /Utiliser un cours de mon forfait.*4 cours restants/ })).toBeChecked();
  await page.getByRole("button", { name: "Réserver ce cours" }).click();
  await expect(page).toHaveURL(/\/student\/lessons\?booked=/);
  await expect(page.getByText("Tina Teacher : 3 cours restants sur 5")).toBeVisible();

  // Cancelling more than 12 hours ahead returns the credit
  page.once("dialog", (d) => {
    expect(d.message()).toContain("remboursé intégralement");
    d.accept();
  });
  await page.getByRole("button", { name: "Annuler" }).last().click();
  await expect(page.getByText("Tina Teacher : 4 cours restants sur 5")).toBeVisible();
  const pack = await db.lessonPackage.findFirstOrThrow({ where: { teacherId: teacher.id } });
  expect(pack).toMatchObject({ totalLessons: 5, usedLessons: 1, priceXaf: 20000, unitPriceXaf: 4000, discountPct: 20 });
});

test("the same time cannot be booked twice, even by the database directly", async ({ browser }) => {
  const { teacher } = await bookableTeacher(5000);
  const a = await createUser("STUDENT", { learning: true });
  const b = await createUser("STUDENT", { learning: true });
  const pa = await browser.newPage();
  const pb = await browser.newPage();
  await login(pa, a.email);
  await login(pb, b.email);
  await pa.goto(`/fr/teachers/${teacher.id}`);
  await pb.goto(`/fr/teachers/${teacher.id}`);

  // Both see the same first slot; A takes it first
  await firstSlot(pb).click();
  await pickSlotAndContinue(pa, /Cours à l'unité/);
  await expect(pa).toHaveURL(/\/checkout\//);
  await pb.getByRole("radio", { name: /Cours à l'unité/ }).check();
  await pb.getByRole("button", { name: "Continuer" }).click();
  await expect(pb.getByText("Désolé, ce créneau vient d'être pris.")).toBeVisible();

  // The database refuses an overlapping booking even if the app checks were skipped
  const held = await db.booking.findFirstOrThrow({ where: { teacherId: teacher.id, status: "HELD" } });
  const sb = await db.studentProfile.findUniqueOrThrow({ where: { userId: b.id } });
  await expect(
    db.booking.create({
      data: { studentId: sb.id, teacherId: teacher.id, type: "SINGLE", status: "CONFIRMED", startsAt: new Date(held.startsAt.getTime() + 20 * 60_000), endsAt: new Date(held.endsAt.getTime() + 20 * 60_000), priceXaf: 5000, commissionPct: 18 },
    }),
  ).rejects.toThrow(/booking_no_overlap/);

  // When A's 15 minutes run out, the slot is free again
  await db.booking.update({ where: { id: held.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
  await pa.reload();
  await expect(pa.getByText("Votre réservation a expiré.")).toBeVisible();
  await pb.goto(`/fr/teachers/${teacher.id}`);
  await pickSlotAndContinue(pb, /Cours à l'unité/);
  await expect(pb).toHaveURL(/\/checkout\//);
});

test("late cancellation is not refunded; earlier lessons can be moved", async ({ page }) => {
  const { teacher } = await bookableTeacher(5000);
  const student = await createUser("STUDENT", { learning: true });
  const sp = await db.studentProfile.findUniqueOrThrow({ where: { userId: student.id } });
  const at = (h: number) => new Date(Math.ceil((Date.now() + h * 3_600_000) / 1_800_000) * 1_800_000);
  const mk = (h: number) =>
    db.booking.create({ data: { studentId: sp.id, teacherId: teacher.id, type: "SINGLE", status: "CONFIRMED", startsAt: at(h), endsAt: new Date(at(h).getTime() + 50 * 60_000), priceXaf: 5000, commissionPct: 18 } });
  const soon = await mk(7);
  const later = await mk(72);

  await login(page, student.email);
  await page.goto("/fr/student/lessons");
  const items = page.locator("li").filter({ has: page.getByRole("button", { name: "Annuler" }) });
  await expect(items).toHaveCount(2);

  // Soon: cannot be moved; cancelling warns there is no refund
  await expect(items.first().getByText("il ne peut plus être déplacé")).toBeVisible();
  await expect(items.first().getByRole("button", { name: "Changer l'horaire" })).toHaveCount(0);
  page.once("dialog", (d) => {
    expect(d.message()).toContain("vous ne serez PAS remboursé");
    d.accept();
  });
  await items.first().getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByText("Annulé par l'élève")).toBeVisible();
  const log = await db.auditLog.findFirstOrThrow({ where: { targetId: soon.id, action: "BOOKING_CANCELLED" } });
  expect(log.meta).toMatchObject({ refunded: false, lateCancel: true });

  // Later: move it to another time
  await page.getByRole("button", { name: "Changer l'horaire" }).click();
  await page.locator("button[data-slot]").nth(5).click();
  await page.getByRole("button", { name: "Changer l'horaire" }).last().click();
  await expect.poll(async () => (await db.booking.findUniqueOrThrow({ where: { id: later.id } })).rescheduledFrom).toBe(later.startsAt.toISOString());
});

test("teacher adds a day off and students can't book it", async ({ browser }) => {
  const { user, teacher } = await bookableTeacher(5000);
  const tp = await browser.newPage();
  await login(tp, user.email);
  await tp.goto("/fr/teacher/calendar");
  // A day three days from now, in Douala time
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(new Date(Date.now() + 3 * 86_400_000));
  await tp.getByLabel("Du").fill(day);
  await tp.getByRole("button", { name: "Ajouter des jours de congé" }).click();
  await expect(tp.getByRole("button", { name: /^Retirer: / })).toBeVisible();
  const off = await db.availabilityException.findFirstOrThrow({ where: { teacherId: teacher.id } });
  expect(off.endsAt.getTime() - off.startsAt.getTime()).toBe(86_400_000);

  // A student in Douala sees times on the days around it, but none on that day
  const student = await createUser("STUDENT", { learning: true });
  const sp = await browser.newPage();
  await login(sp, student.email);
  await sp.goto(`/fr/teachers/${teacher.id}`);
  await expect(firstSlot(sp)).toBeVisible();
  const label = new Intl.DateTimeFormat("fr", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const labels = await sp.locator("button[data-slot]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.filter((l) => l.startsWith(`${label} `))).toEqual([]);
});

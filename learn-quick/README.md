# Learn Quick

Live English and French tutoring for Cameroon and beyond: verified teachers, live video lessons,
MTN Mobile Money / Orange Money payments and a translation practice library.

Design and data model: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Project setup, data model, auth & roles, English/French, layout & design system | ✅ Done |
| 2 | Student learning profile, settings pages, public teacher profile, saved teachers | ✅ Done |
| 3 | Teacher application wizard, uploads, admin review, badges | ✅ Done |
| 4 | Teacher catalogue, availability calendar, booking | ✅ Done |
| 5 | Payments (MTN / Orange via Campay), wallet, ledger, escrow, payouts | ✅ Done |
| 6 | Live video classroom, attendance, reviews | Next |
| 7 | Translation library and AI grading | |
| 8 | Admin tools, notifications, messaging, hardening | |

## Run it locally

You need Node.js 20+ and PostgreSQL 16 (or Docker).

```bash
docker compose up -d db
```

```bash
cp .env.example .env
```

Set `AUTH_SECRET` in `.env` (run `npx auth secret` to generate one) and an admin email and password, then:

```bash
npm install
```

```bash
npx prisma migrate dev
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Optional: add three demo teachers and a demo student (password `Demo12345`, emails ending in `@demo.learnquick.test`):

```bash
SEED_DEMO=1 npm run db:seed
```

Open http://localhost:3000. Without email/SMS keys, verification codes are printed in the terminal.
In development you can set `OTP_FIXED_CODE="123456"` in `.env` so every code is the same.

## Tests

```bash
npm test
```

Browser tests use their own database (`learnquick_test`) and upload folder (`storage-test/`), so test accounts never mix with your data. Create the database once:

```bash
createdb -O lq learnquick_test
```

```bash
npm run build && npm run test:e2e
```

## Uploaded files

- Files are stored on the server's disk in `storage/` (set `STORAGE_DIR` to change it). Back this folder up.
- ID documents, certificates and diplomas are **encrypted** with `FILE_ENCRYPTION_KEY` and only the owner and admins can open them. Set this key before the first upload and never change it.
- The real file type is checked from the file's content, not its name. Size limits: photos 5 MB, documents 10 MB, videos 100 MB.
- ID documents are deleted 90 days after an application is approved or rejected. Run this once a day (for example with cron):

```bash
npm run jobs:purge-files
```

## Teacher applications

1. A teacher fills in 10 steps at `/teacher/application`. Progress is saved after every step.
2. On submit, the application waits in **Admin → Teacher applications**.
3. The admin starts the review and approves, asks for changes on, or rejects each section, with a comment.
4. "Send change requests" lets the teacher edit only the sections marked for changes; approved sections stay approved in the next round.
5. "Approve and publish" makes the profile public and awards badges: Verified ID always, Certified when a certificate was checked, Professional when the admin ticks it.

The teacher is notified by email (or SMS) at each decision.

## Booking lessons

- Students find teachers at `/teachers` (filters: language, price, days, time of day, specialty, country, native speaker, certified).
- Times are shown in the student's time zone and stored in UTC. Lessons last 50 minutes and start on the hour or half hour, at least 6 hours ahead.
- Options: trial lesson (first lesson with a teacher only), single lesson, or packs of 5, 10 or 20 with the teacher's discount. Later lessons from a pack are booked with a credit, without paying again.
- A chosen time is held for 15 minutes during checkout. **The database itself refuses overlapping lessons**, so two students can never get the same time.
- Students can cancel or move a lesson for free until 12 hours before it. Later cancellations are not refunded. Teachers can always cancel; the student is refunded in full. (Money movements arrive with payments in Phase 5; cancellations already record what is owed.)
- Teachers change their weekly hours and add days off at `/teacher/calendar`.

Run this every 10 minutes (for example with cron) to release unpaid holds and send reminders 24 hours and 1 hour before each lesson:

```bash
npm run jobs:bookings
```

## Payments (Campay: MTN Mobile Money and Orange Money)

**How a payment works:** the student enters their MTN or Orange number at checkout → Campay sends a request to their phone → they approve with their PIN → the page confirms the lesson by itself.

**Where the money goes** (every movement is a balanced entry in the ledger):

| Event | Money moves |
|---|---|
| Student pays | Mobile Money → held for the lesson |
| Lesson ends | held → teacher "pending" (82 %) + platform fee (18 %) |
| 24 hours later, no dispute | teacher "pending" → "available" |
| Student cancels 12+ hours ahead, or teacher cancels | held → student wallet (pack lessons get their credit back instead) |
| Student cancels later than that | held → teacher, as if the lesson happened |
| Withdrawal | "available" (or wallet) → set aside → sent to Mobile Money after admin approval |

**Safety:**
- Webhooks are never trusted: they only tell the app which payment to re-check, and the real status and amount are always fetched from Campay with our own credentials. A forged webhook cannot confirm anything (there is a test for this).
- Each payment is confirmed exactly once, even if the webhook, the checkout page and the background job all report it at the same time.
- A payment for the wrong amount, or one approved after the time was taken, goes to the student's wallet instead of being lost.
- Sending money out needs the person's password. Admin approval is on by default (`payoutRequiresApproval`).
- **Admin → Payments** shows money held, revenue, withdrawals to approve, and whether the ledger is balanced.

**Test mode:** `PAYMENT_PROVIDER=sandbox` (the default) simulates payments. Checkout then shows "approve / decline on phone" buttons. The sandbox refuses to run on a live site.

**Going live with Campay:**

1. Create an app at campay.net and enable **API withdrawals** in the app settings.
2. Set `PAYMENT_PROVIDER=campay`, `CAMPAY_USERNAME`, `CAMPAY_PASSWORD` (or `CAMPAY_ACCESS_TOKEN`) and `CAMPAY_WEBHOOK_KEY`. Use `CAMPAY_BASE_URL=https://demo.campay.net` to test, then `https://www.campay.net`.
3. In the Campay dashboard, set the webhook URL to `https://YOUR-SITE/api/webhooks/campay`.
4. Make one small real payment and one small withdrawal before opening to students.

Run this every 5 minutes (re-checks waiting payments, completes lessons, releases earnings, checks withdrawals):

```bash
npm run jobs:money
```

## How sign-up works

- People register as **Student** or **Teacher** with a phone number, an email, or both, then confirm a 6-digit code (SMS first, email as an alternative).
- Teachers get a draft application. They cannot be booked until an admin approves it (Phase 3).
- Admins are created only by the seed script, never through the sign-up form.
- Google sign-in appears when `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` are set; those users choose their role on an onboarding page.
- Role, status and verification are read from the database on every request, so suspending a user takes effect at once.

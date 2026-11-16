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
| 6 | Live classroom (video, chat, whiteboard, notes, files), attendance, reviews | ✅ Done |
| 7 | Translation library and AI grading | ✅ Done |
| 8 | Admin tools, notifications, messaging, disputes, hardening | ✅ Done |

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

## Live classroom

Lessons happen at `/lesson/<booking id>`. The **Join** button appears on "My lessons" 10 minutes before the start; the room closes 30 minutes after the end. Only the lesson's student and teacher can enter (admins can read the lesson record but not join the call).

- **Before joining:** camera preview, microphone level, device choice and a speaker test. People without a camera can join with audio only, or with nothing.
- **In the lesson:** video and audio, mute, camera on/off, screen sharing (on computers), an **audio-only** switch that saves mobile data (suggested automatically when the connection is weak), a connection-quality badge, chat with file sharing, a shared whiteboard and shared notes. Chat, whiteboard and notes are saved with the lesson.
- **Video technology:** WebRTC, directly between the two browsers. Video is limited to about 400 kbit/s. The server only introduces the two browsers to each other and carries chat, whiteboard, notes and presence (Server-Sent Events).
- **Attendance decides the money:** both joined → completed; only the teacher → student absent, teacher paid; teacher absent → student refunded (or pack credit returned).
- **After the lesson:** the student rates it (1–5 stars and a review on the teacher's profile; "Top rated" at 4.8+ with 20+ lessons); the teacher writes notes and homework, which the student sees.

**Before going live:**
- Add a **TURN server** (`TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`). Without one, calls fail on networks that block direct connections, which includes some mobile networks. Managed TURN services cost little.
- The live messages (chat, whiteboard, signalling) are kept in the memory of one server process. Run **one** app server, or add Redis pub/sub before running several.
- Lesson recording is not built: it needs a media server (such as LiveKit) and storage.

## Translation library (free for students and teachers)

The library is at `/library`. Visitors can see it; practising needs a free account (student or teacher).

- **60 exercises** from A1 to C2, English → French and French → English: sentences, paragraphs, fill-the-gap and multiple choice, on everyday topics, travel, business, health, law and more.
- **Practice:** choose a direction and level (and optionally a topic) and get 5 random exercises. Answers save as you type. French accent buttons insert characters at the cursor.
- **Hints:** "Show key words" reveals vocabulary but lowers that question's score by 20 %.
- **Exams A1–C2:** 10 questions, 30 minutes, the page submits by itself when time runs out (the server also closes late exams). 70 % or more gives a printable **practice certificate** (`LQ-B2-…`), which clearly says it is not an official diploma.
- **Results:** a score per question, mistakes highlighted in the student's own text with an explanation and the correct words, a corrected version, scores for meaning / grammar / vocabulary / style, and model translations.
- **Progress** (`/library/history`): a score chart, averages by direction and level, the most frequent mistake types and the suggested next level.

**How grading works**

| Exercise | Graded by |
|---|---|
| Multiple choice, fill-the-gap | The app, at once (a gap answer right except for an accent gets 80 %) |
| Sentences and paragraphs | Claude (AI), when `ANTHROPIC_API_KEY` is set; otherwise a basic similarity score against the model translations |

- AI grading runs in the background after submitting; the results page updates by itself, usually within a few seconds.
- The **total is always calculated by the app** from the four part scores (meaning 40 %, grammar 25 %, vocabulary 20 %, style 15 %), so the AI cannot invent a score. The student's text is treated as text to grade, never as instructions.
- If the AI is unavailable, the student sees the basic score at once and the AI correction is retried up to 3 times by the background job.
- Each person gets at most `libraryAiGradesPerDay` AI corrections per day (30, editable in settings); after that the basic score is used.
- The model is `claude-opus-5-5` (change with `GRADER_MODEL`). If the model declines a request, the API retries on a fallback model in the same call. `LIBRARY_GRADER=basic` turns AI grading off.

**Adding exercises:** admins use **Library → Manage** (`/library/manage`) to write, check and publish exercises, or import a JSON list. Approved teachers can propose exercises; they stay drafts until an admin publishes them. `npx prisma db seed` adds or updates the built-in 60 exercises and the 6 exams.

Run this every 5 minutes (retries AI corrections, closes exams whose time is up):

```bash
npm run jobs:library
```

## Messages

- Students can write to any published teacher from their profile ("Send a message"). Teachers can write to students who booked them (from "My lessons"). Admins don't take part, but they can read a conversation that was reported.
- **Phone numbers, emails, links and app names (WhatsApp, Telegram…) are hidden** until the student has paid for a lesson with that teacher, so lessons and payments stay on the platform. The sender is told when this happens.
- New messages appear live (no reload), with an unread badge in the header and "Seen" receipts. The other person gets one email or SMS per conversation until they read it, not one per message.
- Limits: 20 messages per 5 minutes per person; students can open 10 new conversations a day.
- Anyone can **report** a conversation. Admins see it in **Admin → Reports**, read it, then suspend an account or close the report.

## Notifications

- The bell in the header shows unread notifications and updates live. `/notifications` lists them; opening one marks it read and goes to the related page (only links inside the site are followed).
- In **Settings → Notifications**, people choose which kinds (lessons, messages, payments) are also sent by email (or SMS when they have no email). Account notices are always sent.

## Disputes

- Until the end of the 24-hour window after a lesson, the student can **report a problem** from "My lessons". The teacher's earnings for that lesson stay on hold, even after the window ends.
- The teacher is notified and can give their side once.
- In **Admin → Disputes**, the admin sees both statements, who joined the classroom and when, and the lesson record, then chooses:
  - **full refund**: the price goes back to the student's wallet (taken from the teacher's pending earnings and the platform fee);
  - **half refund**: half back to the student, the other half paid to the teacher at once;
  - **no refund**: the teacher is paid at once.
- The decision is one database transaction in the ledger, can only be made once, and both people are notified with the admin's explanation.

## Admin tools

| Page | What it does |
|---|---|
| Overview | Counts, and a "to do" list: applications, disputes, reports, withdrawals |
| Users | Search by name, email or phone; filter by role and status. A user page shows balances, lessons, payments, reviews and history. **Suspend** signs the person out at once, hides a teacher from the catalogue and cancels their upcoming lessons with a full refund to students. Admins can hide unfair reviews (the rating is recalculated). |
| Disputes / Reports | See above |
| Settings | Platform fee, cancellation and booking rules, payment and withdrawal rules, review time, AI corrections per day. Values are checked against safe limits. |
| Audit log | Every important action (sign-ups, approvals, cancellations, suspensions, refunds, setting changes…) with who did it and when |

## Security

- **Security headers** on every page: Content Security Policy (only this site's scripts and connections; no embedding in other sites), `nosniff`, strict referrer, camera/microphone only for this site, and HSTS when the site runs on https.
- **Limits against abuse:** 10 sign-in tries per account and 50 per network every 15 minutes; 10 new accounts per network per hour; 8 verification codes per person per day; message limits above. They are kept in the server's memory (one server; use Redis if you run several). `RATE_LIMITS=off` is only for automated tests on a local computer and is ignored on a live site.
- Role, status and verification are read from the database on every request; money movements are double-entry and can't be posted twice; webhooks are never trusted; uploaded documents are encrypted.
- `GET /api/health` returns `{"ok":true}` when the app and the database answer (for uptime monitoring).

## Going live checklist

1. A server (or platform) running Node.js 20+ and **PostgreSQL 16**. Run `npx prisma migrate deploy` and `npx prisma db seed` (creates the admin, settings and library).
2. Set `NEXT_PUBLIC_SITE_URL=https://your-domain`, a strong `AUTH_SECRET`, `FILE_ENCRYPTION_KEY` (and keep a copy safe), `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
3. Email (`RESEND_API_KEY`, `EMAIL_FROM`) and SMS (`AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID`).
4. Campay (`PAYMENT_PROVIDER=campay` and the `CAMPAY_*` values), webhook URL set in the Campay dashboard. Test one small payment and one withdrawal.
5. A TURN server for video calls (`TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`).
6. `ANTHROPIC_API_KEY` for AI correction in the library (optional).
7. Background jobs with cron:
   ```
   */5  * * * *  npm run jobs:money
   */10 * * * *  npm run jobs:bookings
   */5  * * * *  npm run jobs:library
   0    3 * * *  npm run jobs:purge-files
   ```
8. Run **one** app server (live messages and limits are kept in memory), behind https. Back up the database and the upload folder every day.
9. Point an uptime monitor at `/api/health`.

## How sign-up works

- People register as **Student** or **Teacher** with a phone number, an email, or both, then confirm a 6-digit code (SMS first, email as an alternative).
- Teachers get a draft application. They cannot be booked until an admin approves it (Phase 3).
- Admins are created only by the seed script, never through the sign-up form.
- Google sign-in appears when `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` are set; those users choose their role on an onboarding page.
- Role, status and verification are read from the database on every request, so suspending a user takes effect at once.

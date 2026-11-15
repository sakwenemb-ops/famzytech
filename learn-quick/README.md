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
| 4 | Teacher catalogue, availability calendar, booking | Next |
| 5 | Payments (MTN / Orange), wallet, ledger, escrow, payouts | |
| 6 | Live video classroom, attendance, reviews | |
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

## How sign-up works

- People register as **Student** or **Teacher** with a phone number, an email, or both, then confirm a 6-digit code (SMS first, email as an alternative).
- Teachers get a draft application. They cannot be booked until an admin approves it (Phase 3).
- Admins are created only by the seed script, never through the sign-up form.
- Google sign-in appears when `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` are set; those users choose their role on an onboarding page.
- Role, status and verification are read from the database on every request, so suspending a user takes effect at once.

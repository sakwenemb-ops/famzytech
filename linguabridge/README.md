# LinguaBridge

Live English and French tutoring for Cameroon and beyond: verified teachers, live video lessons,
MTN Mobile Money / Orange Money payments and a translation practice library.

Design and data model: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Project setup, data model, auth & roles, English/French, layout & design system | ✅ Done |
| 2 | Student and teacher onboarding details, profile pages | Next |
| 3 | Teacher application wizard, uploads, admin review, badges | |
| 4 | Teacher catalogue, availability calendar, booking | |
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

Open http://localhost:3000. Without email/SMS keys, verification codes are printed in the terminal.
In development you can set `OTP_FIXED_CODE="123456"` in `.env` so every code is the same.

## Tests

```bash
npm test
```

```bash
npm run build && npm run test:e2e
```

## How sign-up works

- People register as **Student** or **Teacher** with a phone number, an email, or both, then confirm a 6-digit code (SMS first, email as an alternative).
- Teachers get a draft application. They cannot be booked until an admin approves it (Phase 3).
- Admins are created only by the seed script, never through the sign-up form.
- Google sign-in appears when `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` are set; those users choose their role on an onboarding page.
- Role, status and verification are read from the database on every request, so suspending a user takes effect at once.

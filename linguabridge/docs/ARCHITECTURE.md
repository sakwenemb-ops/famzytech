# LinguaBridge: Phase 0 design

## 1. System architecture

```
                 ┌──────────────────────── Browser (mobile-first, EN/FR) ────────────────────────┐
                 │  Public pages (SSR, SEO)   Dashboards   Lesson room (LiveKit JS)   Test screen  │
                 └───────────────┬───────────────────────────────┬───────────────────────────────┘
                                 │ HTTPS                         │ WebRTC (media)
                 ┌───────────────▼──────────────┐       ┌────────▼─────────┐
                 │   Next.js app (App Router)   │       │  LiveKit Cloud   │
                 │  • Server components / SSR   │──────▶│  (rooms, tokens, │
                 │  • Server actions (Zod)      │ token │   recording)     │
                 │  • Route handlers:           │       └──────────────────┘
                 │    /api/webhooks/payments    │◀───── payment provider callbacks
                 │    /api/webhooks/livekit     │◀───── room join/leave events
                 │  • Auth.js (roles)           │
                 └──┬──────────┬──────────┬─────┘
                    │          │          │
          ┌─────────▼──┐  ┌────▼─────┐  ┌─▼──────────────┐   ┌──────────────────────┐
          │ PostgreSQL │  │  Redis   │  │ Cloudflare R2  │   │ Worker (BullMQ)      │
          │  (Prisma)  │  │ (queue,  │  │ public: photos,│   │ • hold expiry (15m)  │
          │            │  │ rate     │  │   videos       │   │ • payment polling    │
          │            │  │ limits)  │  │ private: IDs,  │   │ • escrow release     │
          │            │  │          │  │   certificates │   │ • reminders 24h/1h   │
          └────────────┘  └──────────┘  └────────────────┘   │ • payouts            │
                                                             │ • translation grading│
                                                             │ • ID/recording purge │
                                                             └──────────┬───────────┘
                                                                        │
                              ┌──────────────┬──────────────┬───────────┴─────┐
                              ▼              ▼              ▼                 ▼
                       Payment provider   Claude API     Resend (email)   SMS provider
                       (MTN + Orange)     (grading)
```

**Main design choices**

- **One codebase, one deploy** for the web app, plus a small worker process that uses the same code. That's simple to run, and it scales out later.
- **Payments sit behind a `PaymentProvider` interface:** `requestPayment`, `getStatus`, `verifyWebhook`, `disburse`. Code for MTN, Orange or an aggregator is swapped in by config. A `SandboxProvider` simulates success, failure and timeouts with test numbers.
- **Money is integer XAF and goes through a double-entry ledger.** Every movement is one transaction whose lines add up to 0. Wallet and earnings balances come from the ledger.
- **Escrow flow:**
  `payment in → PLATFORM_CLEARING → TEACHER_PENDING`
  When the lesson is complete and 24h pass with no dispute: `→ TEACHER_AVAILABLE (price − commission) + PLATFORM_REVENUE (commission)`
- **No double booking:** a Postgres `EXCLUDE` constraint on the teacher plus the time range, for bookings in `HELD` or `CONFIRMED`. Holds expire after 15 minutes through a delayed job.
- **Lesson completion** is decided from LiveKit webhook join/leave events (`LessonAttendance`), not from the browser.
- **ID documents** go in a private bucket, are encrypted before upload (AES-GCM, key from KMS/env), are viewable only by admins through 5-minute signed URLs, and are deleted 90 days after a decision.
- **Grading:** Claude is called from the worker with a fixed rubric and a JSON schema. The output is validated with Zod and retried up to 2 times. If it still fails, the attempt goes to `PENDING_REVIEW`.
- **i18n:** next-intl with `/en` and `/fr` routes. The default is French, switched by `Accept-Language`. hreflang is on every public page.

## 2. Data model

See [`prisma/schema.prisma`](../prisma/schema.prisma) (validated). Main groups:

| Area | Models |
|---|---|
| Users & auth | User, Account, Session, VerificationToken, StudentProfile, TeacherProfile |
| Verification | TeacherApplication, ApplicationReview (per section, per round), TeacherBadge, Certificate, Education, Document, ProfileEdit |
| Booking | AvailabilityRule, AvailabilityException, LessonPackage, Booking, Dispute, Review |
| Live lessons | Lesson, LessonAttendance, LessonChatMessage |
| Money | Payment, WebhookEvent, LedgerAccount, LedgerTransaction, LedgerLine, Payout |
| Library | Exercise, Test, TestItem, TestAttempt, TestAnswer |
| Comms & admin | Conversation, Message, Notification, NotificationPreference, PlatformSetting, AuditLog |

## 3. Provider recommendations

### Payments: start with an aggregator (recommended: **Campay** or **Notch Pay**), keep direct APIs as a later option

| | Aggregator (Campay / Notch Pay / CinetPay) | Direct MTN MoMo + Orange Money APIs |
|---|---|---|
| Integrations to build | 1 API for both operators | 2 different APIs, auth flows and webhook formats |
| Onboarding | Fast; business documents needed | Slow; separate merchant contracts with each operator |
| Payouts to teachers | Included (disbursement / transfer API) | MTN Disbursements needs separate approval; Orange payout access is harder to get |
| Fees | Somewhat higher per transaction | Lower |

**Recommendation:** launch with one aggregator behind the `PaymentProvider` interface. When volume makes the fee difference matter, add direct MTN and Orange providers without touching the booking code. Before choosing, **confirm the current fees, payout support and KYC needs** with Campay, Notch Pay and CinetPay. These change often, and I haven't checked their 2026 terms.

### Video: **LiveKit Cloud**

- Open source, so it can later be self-hosted on servers closer to Central Africa to save cost and lag.
- Simulcast and adaptive streams, plus audio-only fallback. This matters most on 3G/4G in Cameroon.
- Good React components, room webhooks for attendance, and recording through Egress.
- Alternative: Daily.co (simpler, but more expensive and closed source).

### Others
- **Email:** Resend.
- **SMS/OTP:** Africa's Talking (local operators, cheaper in Cameroon than Twilio).
- **Storage:** Cloudflare R2 (no egress fees, which matters for intro videos).
- **Grading:** Claude API (latest Sonnet model for cost and speed; a stronger model only for C1–C2 paragraphs).
- **Hosting:** Vercel or a VPS with Docker for the app, a managed Postgres (Neon/Supabase) and Upstash Redis. Or put everything on one VPS with Docker Compose to start cheap.

## 4. Open questions (answers change the build)

1. **Brand name and domain:** keep "LinguaBridge"?
2. **Countries:** Cameroon only at launch, or other XAF/XOF countries too (Gabon, Congo, Côte d'Ivoire, Senegal)? This changes currency handling and payment providers.
3. **Payment provider:** do you already have a merchant account with MTN, Orange or an aggregator? If not, which business entity will sign up?
4. **Commission:** is 18% right? Does the platform take a commission on trial lessons?
5. **Who writes library content:** should I generate the 60 starter exercises with AI (reviewed by you), or do you have your own material?
6. **Translation grading cost:** is the library free for all students, free for students with at least one paid lesson, or a paid subscription?
7. **Hosting budget:** Vercel plus managed services (easier, about $50–100/month to start), or one VPS (cheaper, about $20/month, more maintenance)?
8. **Where the code lives:** this session has no GitHub repository attached, and files here are lost when the session ends. Do you want me to push to a GitHub repo? If so, create or attach an empty repo and tell me its name.

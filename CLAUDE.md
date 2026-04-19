# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start dev server (file polling enabled for Docker compatibility)
npm run build         # Validate env vars, then Next.js production build
npm run lint          # ESLint
npm run type-check    # TypeScript check without emitting
npm run test          # Jest
npm run test:watch    # Jest in watch mode
npm run test:coverage # Jest with coverage report
npm run seed          # Seed Supabase with test data (test@minbarai.com)
npm run seed:cleanup  # Remove seeded test data
npm run migrate       # Apply pending DB migrations (requires DATABASE_URL in .env.local)
npm run migrate:dry-run  # Preview pending migrations without applying them
```

`npm run build` runs `scripts/validate-build-env.js` first — required env vars must be set or the build will fail.

## Architecture

**MinberAI** is a Next.js 14 SaaS platform for live multi-language translation. Users subscribe (Stripe), log in (Supabase Auth), and get access to a real-time translation dashboard powered by a VoiceFlow WebSocket backend.

### Request flow & route protection

`middleware.ts` intercepts every request and enforces three access tiers:

1. **`/admin/*`** — must be authenticated AND have an email in the `ADMIN_EMAILS` env list (`lib/auth/admin.ts`)
2. **`/dashboard/*`** — must be authenticated with a valid/active Stripe subscription (queries `users.subscription_status`)
3. **`/auth/*`** (when already signed in) — redirected to `/dashboard` or `/subscribe` depending on subscription state

The middleware performs a single DB query per request for routes that need subscription data. It also applies security headers to every response via `lib/auth/security-headers.ts`.

### Supabase clients — three distinct clients

| File | When to use |
|---|---|
| `lib/supabase/server.ts` | Server Components, Route Handlers, middleware |
| `lib/supabase/admin.ts` | Service-role operations (webhooks, admin APIs) — bypasses RLS |
| `lib/supabase/browser.ts` (client component) | Client-side auth state |

Never use the admin client in user-facing code. The admin client uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses all Row-Level Security.

### Database schema (`supabase/database.sql`)

Three core tables:
- **`users`** — extends `auth.users` with subscription state (`subscription_status`, `subscription_id`, `customer_id`, `subscription_period_end`, `session_limit_minutes`)
- **`usage_sessions`** — one active session per user enforced by a partial unique index; status enum: `active | closed | expired | capped`
- **`stripe_webhook_events`** — idempotency table; Stripe event IDs are the primary key

The schema file is authoritative for **fresh database setup** — run it in the Supabase SQL editor to create everything from scratch.

For **incremental changes** to an existing database, use the migration system:
- Migration files live in `supabase/migrations/` and are named `NNN_description.sql`
- Run `npm run migrate` to apply pending migrations (requires `DATABASE_URL`)
- The runner creates a `public._migrations` tracking table on first run
- Each migration runs in a transaction — it rolls back automatically on error
- Migration files use `IF NOT EXISTS` / `CREATE OR REPLACE` so they are safe to re-run

### Stripe integration

- Checkout and billing portal flows live in `app/api/stripe/`
- Webhooks at `/api/stripe/webhooks` use the admin Supabase client and write to `stripe_webhook_events` for idempotency before processing
- Subscription state flows: Stripe webhook → updates `users.subscription_status` + `subscription_period_end`
- Cancelled subscriptions stay accessible until `subscription_period_end` passes (checked in middleware and `lib/subscription.ts`)

### Authentication security layer (`lib/auth/`)

Rate limiting, email validation, password strength, and account lockout (5 failed attempts) are implemented in `lib/auth/`. These wrap Supabase Auth — call the auth utility functions rather than Supabase directly in auth routes.

### VoiceFlow & real-time translation

The live translation pipeline connects via WebSocket to a VoiceFlow backend (`NEXT_PUBLIC_VOICEFLOW_WS_URL`). The adapter lives in `lib/voiceflow/`. Google Gemini (`GEMINI_API_KEY`) is available as an AI fallback. Socket.io is used for real-time session coordination.

### PDF Transcript Download (`components/dashboard/live-captioning/pdf/`)

Users can export live captioning sessions as premium PDF documents. The implementation uses **`@react-pdf/renderer`** for client-side PDF generation (no backend processing). Key design points:

**Dynamic imports & SSR safety:**
- `@react-pdf/renderer` depends on pdfkit, which uses Node.js APIs (canvas, streams)
- The import must live inside the async `downloadTranscriptPDF()` function, not at module top level
- This prevents SSR build failures; webpack fallbacks in `next.config.js` (`canvas: false`, `path: false`) handle the rest

**Font support for RTL languages:**
- **Amiri TTF** files in `/public/fonts/` handle Arabic & Hebrew (RTL scripts) with proper glyph shaping
- Fallback to **Helvetica** (built-in) for Latin and other scripts
- Font selection is automatic based on `language.family` enum ('arabic' → Amiri, others → Helvetica)

**Logo rendering:**
- `TranscriptPDFDocument.tsx` embeds the MinbarAI 3D cube logo from `components/ui/logo-brand.tsx`
- Since @react-pdf/renderer doesn't support React components or SVG imports, the logo is rendered as layered colored rectangles (Views) with darker/lighter shades to suggest 3D depth
- The color palette (`#55a39a`, `#70b3aa`, `#4a9e93`) matches the app's accent theme

**PDF structure (A4 page):**
- **Header** (fixed, every page): MinbarAI logo + "MinbarAI" text + page number
- **Metadata block**: Date, session start time, generation time, source language, target language, translation mode
- **Source section**: Source text in RTL if applicable (e.g., Arabic right-aligned with Amiri font)
- **Translation section**: Target translation in RTL if applicable
- **Footer** (fixed, every page): "Generated by MinbarAI.com" + page number

**Error handling:**
- PDF generation failures are caught and displayed to the user via `AlertDialog`
- The `isPDFGenerating` state provides visual feedback (pulse animation on button)

**Files:**
- `components/dashboard/live-captioning/pdf/TranscriptPDFDocument.tsx` — PDF document component
- `components/dashboard/live-captioning/pdf/downloadTranscriptPDF.tsx` — async download utility
- `components/dashboard/live-captioning/ControlPanel.tsx` — PDF button + prop wiring
- `components/dashboard/live-captioning/index.tsx` — handler + sessionStartedAtRef for preserving timestamp

### Admin panel (`app/admin/`)

Full management dashboard for users, subscriptions, payments, analytics, and real-time active sessions. All `/api/admin/*` routes re-verify admin status server-side — middleware protection is not sufficient alone.

## Key environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public config |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin DB access (bypasses RLS) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PRICE_ID` | Stripe |
| `NEXT_PUBLIC_VOICEFLOW_WS_URL` / `NEXT_PUBLIC_VOICEFLOW_WS_TOKEN` | Translation backend |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Transactional email |
| `NEXT_PUBLIC_SITE_URL` | Used for redirect URLs in auth flows |
| `DATABASE_URL` | Direct Postgres connection string for `npm run migrate` — Supabase → Settings → Database → Connection string → URI (use the **direct** connection, not the pooler) |
| `CRON_SECRET` | Random secret that guards `/api/usage/cleanup` — set as GitHub Actions secret `CRON_SECRET` and as a Cloud Run env var |

See `.env.local` for actual values. Production secrets are stored in Google Secret Manager.

### Usage cleanup cron
`.github/workflows/usage-cleanup-cron.yml` runs every 5 minutes and calls `POST /api/usage/cleanup`.
Two GitHub Actions secrets must be set in the repo settings:
- `CRON_SECRET` — matches the `CRON_SECRET` env var on the Cloud Run service
- `SITE_URL` — production URL, e.g. `https://minbarai.com`

## Deployment

- **Production**: Google Cloud Run (`deploy-pro.sh`), triggers on `main` branch via Cloud Build
- **Development**: Cloud Run dev environment (`deploy-dev.sh`), triggers on all branches
- Docker build uses a multi-stage Dockerfile; health check endpoint is `/api/health`
- `npm run build` must pass (including env validation) before Docker build succeeds

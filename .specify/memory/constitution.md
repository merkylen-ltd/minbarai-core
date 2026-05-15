<!--
Sync Impact Report
==================
Version change: (unversioned template) → 1.0.0
Added sections: Core Principles I–VI, Security Requirements, Development Workflow, Governance
Removed sections: All placeholder tokens replaced; template comments removed
Modified principles: N/A — initial ratification
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ Constitution Check gates align with Principles I–VI
  - .specify/templates/spec-template.md ✅ Requirements/Success Criteria sections align
  - .specify/templates/tasks-template.md ✅ Phase structure aligns with quality gates (Principle V)
Deferred TODOs: None — all fields resolved from codebase context
-->

# MinberAI Constitution

## Core Principles

### I. Security-First

All user-facing code MUST route through the authentication security layer in `lib/auth/`. Rate
limiting, email validation, password strength enforcement, and account lockout (5 failed attempts)
are non-negotiable controls — they MUST NOT be bypassed or disabled.

- Security headers MUST be applied to every HTTP response via `lib/auth/security-headers.ts`.
- The Supabase service-role (admin) client MUST NOT be used in user-facing routes or components.
- All `/api/admin/*` routes MUST re-verify admin status server-side independent of middleware.
- Stripe webhook handlers MUST use the admin client with idempotency keys (`stripe_webhook_events`).
- XSS, CSRF, SQL injection, and all OWASP Top 10 mitigations are required in every new code path.

### II. Supabase Client Segregation

Three distinct Supabase clients exist and MUST be used in the correct context only:

| Client | File | Permitted Context |
|---|---|---|
| Server | `lib/supabase/server.ts` | Server Components, Route Handlers, middleware |
| Admin | `lib/supabase/admin.ts` | Webhooks and admin APIs only — bypasses RLS |
| Browser | `lib/supabase/browser.ts` | Client Components only |

Using the admin client in a page route or client component is a constitution violation and MUST be
caught in code review. RLS is the final line of defence; bypassing it without explicit justification
and peer review is prohibited.

### III. Subscription-Gated Access

Access control is enforced in layers and MUST NOT be weakened:

- Middleware (`middleware.ts`) enforces three tiers: `/admin/*` requires authentication AND membership
  in `ADMIN_EMAILS`; `/dashboard/*` requires an active Stripe subscription; `/auth/*` redirects
  already-signed-in users.
- Subscription state is authoritative only from Stripe webhook events (`stripe_webhook_events`
  table) — no manual database edits to subscription columns are permitted outside the webhook flow.
- Cancelled subscriptions MUST remain accessible until `subscription_period_end` passes, checked
  in both middleware and `lib/subscription.ts`.
- Middleware MUST maintain a single DB query per request for subscription-sensitive routes; N+1
  queries in middleware are prohibited.

### IV. Real-Time Translation Reliability

The live translation pipeline is the core product value and MUST remain continuously available:

- VoiceFlow WebSocket (`lib/voiceflow/`) is the primary translation backend.
- Google Gemini (`GEMINI_API_KEY`) is the AI fallback and MUST engage automatically on VoiceFlow
  failure without surfacing an error to the user.
- Exactly one active session per user is enforced by a partial unique index on `usage_sessions`;
  application code MUST NOT circumvent this constraint.
- Session status transitions (`active → closed | expired | capped`) MUST be persisted atomically.
- Socket.io is used for real-time session coordination; its contracts MUST be respected across
  client and server.

### V. Type Safety & Quality Gates

All code merged to `main` MUST pass every gate below without suppression:

- `npm run type-check` — zero TypeScript errors.
- `npm run lint` — zero ESLint errors.
- `npm run test` — all Jest tests pass.
- `npm run build` — env var validation succeeds and Next.js build completes.

Adding `// eslint-disable`, `@ts-ignore`, `as any`, or `/* eslint-disable */` MUST include an inline
comment explaining why the suppression is safe. Unexplained suppressions are a constitution
violation.

### VI. Immutable Deployment Pipeline

Production deployments MUST flow exclusively through the defined CI/CD pipeline:

- `main` branch → Google Cloud Build → Cloud Run production environment.
- `dev` branch → Cloud Run development environment; all feature branches deploy to dev.
- All environments use Docker multi-stage builds (`Dockerfile`); no runtime dependency installation
  outside the build image.
- Production secrets MUST reside in Google Secret Manager — they MUST NOT be committed to the
  repository or `.env.local`.
- The health check endpoint (`/api/health`) MUST remain functional at all times.
- Environment-specific differences MUST be expressed via env vars, never via code branches.

## Security Requirements

- Password strength enforcement is mandatory via `lib/auth/` — minimum complexity rules apply.
- Brute-force protection: 5 consecutive failed login attempts trigger account lockout.
- HTTPS-only in all deployed environments; security headers MUST include CSP, HSTS, and
  X-Frame-Options.
- `SUPABASE_SERVICE_ROLE_KEY` MUST only appear in server-side, non-user-facing contexts.
- Third-party webhooks (Stripe) MUST verify signatures before processing payloads.

## Development Workflow

1. Feature work starts on a new branch from `dev`.
2. All PRs target `dev`; `main` receives only stable, reviewed, passing-CI changes.
3. The Constitution Check in every plan file gates Phase 0 research — a principle violation requires
   a justification entry in the plan's Complexity Tracking table before work proceeds.
4. Spec, plan, and task artefacts live under `specs/[###-feature-name]/` per the speckit workflow.
5. New package dependencies require a rationale; duplicating capabilities already provided by
   existing packages (e.g., adding a second auth library alongside Supabase Auth) is prohibited.

## Governance

This constitution supersedes all other development practices and documentation where they conflict.
Amendments require:

1. A documented rationale in the PR description or as a constitution comment.
2. A version increment following semantic versioning:
   - **MAJOR**: Backward-incompatible principle removal or redefinition.
   - **MINOR**: New principle or section added or materially expanded.
   - **PATCH**: Clarifications, wording, or non-semantic refinements.
3. A migration plan if existing code violates the amended principle.

All PRs and code reviews MUST verify compliance with Principles I–VI. Complexity MUST be justified
in the plan's Complexity Tracking table. Use `CLAUDE.md` for runtime development guidance during
active sessions.

**Version**: 1.0.0 | **Ratified**: 2026-04-13 | **Last Amended**: 2026-04-13

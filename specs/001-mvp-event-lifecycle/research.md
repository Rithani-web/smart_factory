# Research: MVP Production Event Lifecycle (spec/001)

Phase 0 output — every open technical decision resolved. Format: Decision / Rationale /
Alternatives considered. No NEEDS CLARIFICATION remains.

## D1. Test runner: Vitest + Supertest

- **Decision**: Vitest as the single runner for backend and frontend; Supertest for
  HTTP-level contract tests against the Express app.
- **Rationale**: TypeScript/ESM-native with zero-config TS support (the deferred
  constitution TODO — resolved here and now fixed); aligns with the Vite frontend
  toolchain (one mental model, shared config patterns); fast watch mode helps the
  implement→verify convergence loop. Supertest is the standard thin layer that makes
  contract tests read as direct API calls.
- **Alternatives considered**: Jest (heavier config for ESM + TS, slower startup);
  node:test (built-in but too bare — no fixtures/mocking ergonomics, diverges from the
  frontend toolchain).

## D2. Auth token strategy: dual JWT in HTTP-only cookies

- **Decision**: Short-lived access JWT (~15 min) + long-lived refresh JWT (~7 days),
  both delivered as HTTP-only, SameSite=Lax cookies; refresh endpoint issues a fresh
  access token; logout clears both.
- **Rationale**: satisfies Constitution V (tokens unreadable by client scripts) and the
  project brief (access + refresh); short access lifetime bounds stolen-token damage;
  cookie delivery keeps the frontend simple (no token storage code at all).
- **Alternatives considered**: Authorization-header bearer tokens (contradicts brief +
  requires client-side storage — XSS-exposed); DB-backed session store (extra table +
  infra the MVP doesn't need).

## D3. Password hashing: bcrypt (cost 10)

- **Decision**: bcrypt with cost factor 10 for all password hashes.
- **Rationale**: battle-tested, ubiquitous, pure-JS build works cleanly on Windows
  (relevant: this project runs on the user's Windows machine).
- **Alternatives considered**: argon2id (stronger, but native build on Windows adds
  fragility for zero MVP benefit); Node crypto.scrypt (viable, but less conventional in
  course-style codebases and forces hand-rolled verify/compare plumbing).

## D4. Email: Resend SDK behind a Mailer interface

- **Decision**: `notifications/` wraps Resend behind a small `Mailer` interface
  (`send({to, subject, html})`); every attempt — success or failure — is recorded on the
  event (FR-010). Tests inject a fake Mailer; no network in tests.
- **Rationale**: the brief fixes Resend as the email service; the interface keeps
  contract tests offline and deterministic and isolates the one external dependency the
  lifecycle has.
- **Alternatives considered**: calling the Resend API directly from the events service
  (untestable without network; violates the decoupling spirit of Constitution I/V).

## D5. MVP assignment rule

- **Decision**: at event creation, query `DutyRosterEntry` for technicians whose window
  covers `now`; select the FIRST match in roster order; create the Assignment and the
  history entry synchronously in one transaction. No technician on duty → event stays
  OPEN + marked unassigned + creator informed (FR-008).
- **Rationale**: the spec's stated MVP default ("first available on-duty technician");
  synchronous-in-transaction guarantees SC-002 (Assigned ≤1 min, in practice instantly)
  and keeps assign+notify atomic where possible.
- **Alternatives considered**: least-loaded technician (a capacity model — explicitly
  out of MVP scope); background queue with retries (new infrastructure — forbidden by
  Constitution VI).

## D6. Neon connectivity

- **Decision**: `DATABASE_URL` (already in `backend/.env`, the user's Neon instance)
  with the **pooled** connection string for the running app; Prisma migrations run over
  the **direct** (non-pooled) URL. A `TEST_DATABASE_URL` pointing at a Neon **test
  branch** is used by integration/contract tests (added at implement time, per the
  course's own step 6 pattern).
- **Rationale**: Neon recommends pooled connections for serverless/many-client use and
  direct connections for DDL; a branch-isolated test database keeps test data out of the
  development data — mirroring the course walkthrough exactly.
- **Alternatives considered**: local Docker Postgres (defeats the course's Neon setup
  and adds Docker as a dependency on the user's machine).

## D7. Shared types without new framework

- **Decision**: a `shared/types` workspace package of plain TypeScript interfaces and
  string-union enums (`Role`, `Severity`, `EventStatus`, DTOs, error shape) imported by
  backend and frontend. Backend maps Prisma model → DTO explicitly at the boundary.
- **Rationale**: satisfies Constitution III (one definition per contract, both sides)
  and VI (no new dependency — no zod/TypeSocketry/etc.). Explicit mapping functions keep
  Prisma internals from leaking to the client.
- **Alternatives considered**: zod schemas as single source (adds a dependency the
  original project doesn't name; hand-written types suffice at MVP scale);
  openapi-typescript codegen (adds a build step + spec-file drift risk — a second source
  of truth in tension with Constitution IV).

## D8. Monorepo tooling: npm workspaces

- **Decision**: root `package.json` with `"workspaces": ["backend", "frontend",
  "shared/types"]`; TypeScript project references via a base `tsconfig.json`.
- **Rationale**: built into npm — zero new tools; one `npm install`; workspace imports
  make `shared/` a first-class dependency of both apps.
- **Alternatives considered**: pnpm/yarn workspaces (non-default toolchains on the
  user's machine); Turborepo/Lerna (build orchestration the MVP doesn't need).

## D9. Error shape & lifecycle violation status code

- **Decision**: every error response is `{"error": {"code": string, "message": string}}`.
  Status codes: 400 validation · 401 unauthenticated · 403 role/permission denied ·
  404 unknown id · **409 lifecycle violation** (e.g., technician resolving before
  acknowledgement, acknowledging a non-ASSIGNED event).
- **Rationale**: separating "you may not" (403) from "the event is not in a state that
  allows this" (409) makes contract tests precise and the client UX honest; a single
  error shape satisfies FR-016's "clear message" requirement uniformly.
- **Alternatives considered**: 422 for validation (HTTP-purist but less conventional);
  collapsing all denials into 403 (hides lifecycle bugs from tests).

## D10. First-password enforcement

- **Decision**: `User.mustChangePassword` flag (set on admin provisioning); when set,
  every authenticated request except `POST /api/auth/complete-password-change` returns
  403 `PASSWORD_CHANGE_REQUIRED`. Completing the change clears the flag.
- **Rationale**: FR-019 says the user "MUST set their own new password … before any
  other action" — server-side enforcement of the gate is the only way to make that true
  (Constitution II), and the flag makes the state explicit and testable.
- **Alternatives considered**: frontend-only redirect (untrustworthy — violates
  Constitution II); separate "pending" user status (more states to migrate later).

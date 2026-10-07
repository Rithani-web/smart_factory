# Tasks: MVP Production Event Lifecycle (spec/001)

**Input**: Design documents from `/specs/001-mvp-event-lifecycle/`

**Prerequisites**: plan.md ✅ · spec.md ✅ (19 FRs, 6 stories) · research.md ✅ (D1–D10) · data-model.md ✅ · contracts/rest-api.md ✅ · quickstart.md ✅

**Tests**: REQUIRED — Constitution quality gates demand every acceptance criterion be a
runnable contract test; each story phase below includes its tests first.

**Organization**: by user story (spec priorities: US1–US3 = P1, US4–US5 = P2, US6 = P3)

**Format**: `- [ ] [ID] [P?] [Story?] Description with file path`

## Path Conventions

Web-app monorepo (npm workspaces — plan.md): `backend/src/`, `frontend/src/`,
`shared/types/src/`. Tests: `backend/tests/contract/`, `backend/tests/integration/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: monorepo skeleton, toolchain, all three workspaces bootable

- [ ] T001 Create npm-workspaces monorepo root: `package.json` with
      `workspaces: ["backend", "frontend", "shared/types"]`, root scripts
      (`dev`, `test`, `lint` delegating per workspace), and base
      `tsconfig.base.json` (strict: true, ES2022, NodeNext) per plan.md
- [ ] T002 Scaffold `shared/types` workspace: `package.json` (name
      `@smart-factory/types`), `tsconfig.json`, empty `src/index.ts` exporting all
      type modules — zero runtime dependencies (research D7)
- [ ] T003 [P] Scaffold `backend` workspace: `package.json` (type: module) with deps
      express, @prisma/client, jsonwebtoken, bcrypt, resend and devDeps typescript,
      tsx, vitest, supertest, @types/* — versions pinned per research D1/D3/D4
- [ ] T004 [P] Scaffold `frontend` workspace with Vite + React + TypeScript + Tailwind
      CSS (`npm create vite@latest` template react-ts + tailwind init); add
      dependency on `@smart-factory/types` via workspace protocol
- [ ] T005 [P] Create `backend/.env.example` with every variable quickstart.md §1
      names: `DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_ACCESS_SECRET`,
      `JWT_REFRESH_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `PORT` — placeholder
      values only
- [ ] T006 [P] Add Vitest config to backend (`backend/vitest.config.ts`: node
      environment, contract/integration include patterns) and to frontend
      (`frontend/vitest.config.ts`: jsdom) per research D1
- [ ] T007 [P] Configure ESLint + Prettier for all three workspaces (flat config,
      TypeScript strict rules); add root `npm run lint`
- [ ] T008 Verify `npm install` at root installs all workspaces and
      `npm run dev -w backend` / `-w frontend` both start (hello-world level) —
      then stop: no feature code before Phase 2

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema, shared contracts, auth/RBAC middleware, error shape, mailer —
everything every user story stands on

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [ ] T009 Write `backend/prisma/schema.prisma` implementing data-model.md EXACTLY:
      enums Role(ADMIN/TECHNICIAN/VIEWER), Severity(LOW/MEDIUM/HIGH/CRITICAL),
      EventStatus(OPEN/ASSIGNED/ACKNOWLEDGED/RESOLVED), NotificationStatus(SENT/FAILED),
      HistoryAction(CREATED/ASSIGNED/REASSIGNED/ACKNOWLEDGED/RESOLVED); models User
      (email unique, passwordHash, mustChangePassword default true), ProductionEvent
      (title/description/machineRef non-empty, resolutionNotes nullable),
      Assignment(active flag — exactly one active per event), DutyRosterEntry,
      Notification, HistoryEntry; cuid ids, UTC timestamps (Constitution IV — single
      source of truth)
- [ ] T010 Run `npx prisma migrate dev --name init` against DATABASE_URL (direct Neon
      URL for DDL per research D6); commit generated migration; verify against test
      branch URL too
- [ ] T011 [P] Implement `shared/types/src/user.ts` (Role, `UserDTO { id, name, role }`
      — NO email field, FR-018) and `shared/types/src/auth.ts` (LoginRequest,
      LoginResponse, CompletePasswordChangeRequest)
- [ ] T012 [P] Implement `shared/types/src/event.ts` (Severity, EventStatus,
      `EventDTO { id, title, severity, status, machineRef, createdAt }`,
      EventDetailDTO with reporter/assignee UserDTO + history array, HistoryDTO,
      CreateEventRequest, ResolveEventRequest, ReassignEventRequest) and
      `shared/types/src/api.ts` (`ApiError { error: { code, message } }`, list
      envelopes) per contracts/rest-api.md
- [ ] T013 Implement `backend/src/shared/env.ts` (typed env loader — fail-fast on
      missing variables) and `backend/src/shared/prisma.ts` (singleton PrismaClient)
- [ ] T014 [P] Implement uniform error helpers in `backend/src/shared/errors.ts`:
      `httpError(status, code, message)` and the Express error middleware emitting the
      exact `{"error":{"code","message"}}` shape with 400/401/403/404/409 semantics
      (research D9, FR-016)
- [ ] T015 Implement auth middleware in `backend/src/auth/middleware.ts`:
      `requireAuth` (verify access JWT from cookie → attach user; 401 on
      missing/invalid), `requireRole(...roles)` (403 on mismatch), and the
      `mustChangePassword` gate — when set, every route except
      complete-password-change returns 403 PASSWORD_CHANGE_REQUIRED (research D10,
      Constitution II/III)
- [ ] T016 [P] Implement `backend/src/notifications/mailer.ts`: `Mailer` interface
      `{ send(msg: {to, subject, html}): Promise<void> }` + `ResendMailer` adapter
      using RESEND_API_KEY/MAIL_FROM; failing sends THROW so callers record outcomes
      (research D4, FR-010)
- [ ] T017 [P] Implement test harness `backend/tests/helpers.ts`: in-memory fake
      Mailer capturing sends, app factory (fresh Express app per test), DB reset
      against TEST_DATABASE_URL (Neon test branch, research D6), cookie-jar helper
      for Supertest
- [ ] T018 Wire `backend/src/app.ts` (json body parsing, cookie parsing, /api router
      mount, error middleware LAST) and `backend/src/server.ts` (listen on PORT);
      smoke test: GET /api/health → 200
- [ ] T019 [P] Frontend API client skeleton `frontend/src/services/api.ts`: fetch
      wrapper with `credentials: "include"`, typed responses ONLY via
      @smart-factory/types, ApiError unwrapping (Constitution III)
- [ ] T020 Seed script `backend/prisma/seed.ts`: one ADMIN (known dev password),
      one TECHNICIAN, one VIEWER, and a DutyRosterEntry covering "now" for the
      technician (quickstart §3 precondition) — idempotent

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 — Authenticated, role-gated access (P1) 🎯

**Goal**: only signed-in users act; Admin/Technician/Viewer permissions enforced
server-side; temp-password users are forced to change it first

**Independent Test**: attempt each protected action as each role signed in/out →
allowed/rejected per the contracts RBAC matrix

### Tests for User Story 1 (contract — write FIRST, watch them fail)

- [ ] T021 [P] [US1] Contract test `backend/tests/contract/auth.contract.test.ts`:
      login 200 sets httpOnly cookies + returns `{user:{id,name,role,mustChangePassword}}`;
      bad creds 401 INVALID_CREDENTIALS; unauthenticated GET /events → 401;
      VIEWER create-event → 403; VIEWER users list → 403; TECHNICIAN users list → 403
      (FR-001/002/003/016, SC-005)
- [ ] T022 [P] [US1] Contract test
      `backend/tests/contract/first-password.contract.test.ts`: fresh temp-password
      user hits ANY endpoint (incl. GET /events) → 403 PASSWORD_CHANGE_REQUIRED;
      POST /auth/complete-password-change with weak password → 400; with valid new
      password → 204; then GET /events → 200 (FR-019, US1 scenario 5)

### Implementation for User Story 1

- [ ] T023 [US1] Implement `backend/src/auth/service.ts`: login (bcrypt compare,
      issue access ~15min + refresh ~7d JWTs, set httpOnly SameSite=Lax cookies),
      refresh (rotate access), logout (clear cookies) per research D2
- [ ] T024 [US1] Implement `backend/src/auth/routes.ts`: POST /api/auth/login,
      /refresh, /logout, /complete-password-change (bcrypt-hash new password min 8
      chars, clear mustChangePassword); mount in app.ts
- [ ] T025 [US1] Implement `backend/src/users/service.ts` + `routes.ts`:
      POST /api/users (ADMIN) creating account with generated temporary password
      (returned once in response, mustChangePassword=true, EMAIL_TAKEN 409) and
      GET /api/users (ADMIN) returning UserDTO[] — no email (FR-018/FR-019)
- [ ] T026 [P] [US1] Frontend auth state `frontend/src/services/auth.ts` (login/
      logout/refresh/me against API) + `Login.tsx` page (email+password form, error
      display) with Tailwind styling
- [ ] T027 [P] [US1] Frontend `FirstPasswordChange.tsx` page shown when
      mustChangePassword=true; route guard `RequireAuth`/`RequireRole` components in
      `frontend/src/components/guards.tsx` (client checks are UX ONLY — server
      remains the authority, Constitution II)
- [ ] T028 [US1] Run story tests to green: T021–T022 pass; manual check — sign in as
      each seeded role and confirm UI gating matches the RBAC matrix

---

## Phase 4: User Story 2 — Report a production event (P1)

**Goal**: Admin/Technician create events with validated fields; event recorded as
OPEN with reporter + timestamp; everyone can see the list

**Independent Test**: create an event → appears with entered details, status OPEN,
reporter, timestamp

### Tests for User Story 2

- [ ] T029 [P] [US2] Contract test `backend/tests/contract/create-event.contract.test.ts`:
      ADMIN + TECHNICIAN → 201 with status OPEN and reporter recorded; missing
      title/severity/machineRef → 400 naming the field; severity not in
      LOW/MEDIUM/HIGH/CRITICAL → 400 (FR-004/005/006); VIEWER POST → 403 (FR-016);
      GET /events returns created event (any role) (FR-015)

### Implementation for User Story 2

- [ ] T030 [US2] Implement `backend/src/events/service.ts` createEvent(): validate
      all four fields non-empty + severity enum; insert as OPEN; history entry
      CREATED with actor; return EventDetailDTO — assignment intentionally NOT in
      this task (US3 adds it) (FR-004/005/006/014)
- [ ] T031 [US2] Implement `backend/src/events/routes.ts`: POST /api/events
      (requireRole ADMIN,TECHNICIAN) and GET /api/events (any role, newest first,
      EventDTO shape) mounted with requireAuth (FR-015)
- [ ] T032 [P] [US2] Frontend `CreateEvent.tsx` (title, description, machine/line,
      severity select of exactly LOW/MEDIUM/HIGH/CRITICAL) and `EventList.tsx`
      (cards/table with severity + status badges, OPEN-unassigned visible at a
      glance — SC-001/SC-006); wire routes in App.tsx
- [ ] T033 [US2] Story green: T029 passes; create event via UI → visible in list as
      OPEN with correct fields

---

## Phase 5: User Story 3 — Automatic assignment and notification (P1)

**Goal**: at creation, event auto-assigns to first on-duty technician (roster order)
in one transaction; email dispatched; every attempt recorded; Admin can reassign

**Independent Test**: create event while a known technician is on duty → assigned to
them + notification recorded; with empty roster → stays OPEN + unassigned flag

### Tests for User Story 3

- [ ] T034 [P] [US3] Contract test
      `backend/tests/contract/assignment.contract.test.ts`: with roster entry covering
      now → 201 response status ASSIGNED, active Assignment row for that technician,
      ASSIGNED history entry, fake Mailer captured one send with title/severity/
      machineRef/description (FR-007/009); empty roster → status OPEN, unassigned
      flag true, NO mailer send (FR-008); reassign: ADMIN POST
      /api/events/:id/reassign → prior assignment inactive, new active, REASSIGNED
      history entry, new notification recorded (FR-017); TECHNICIAN/VIEWER reassign →
      403; unknown technicianId → 404 (FR-016)

### Implementation for User Story 3

- [ ] T035 [US3] Extend `backend/src/events/service.ts` createEvent() into ONE
      transaction: insert OPEN event → roster query (DutyRosterEntry where
      startsAt<=now<endsAt, roster order, research D5) → if found: Assignment(active)
      + status ASSIGNED + ASSIGNED history + notification dispatch/record; else
      leave OPEN, response unassigned:true (FR-007/008)
- [ ] T036 [US3] Implement `backend/src/notifications/service.ts` recordAndSend():
      call Mailer, insert Notification(SENT) or Notification(FAILED,error) — delivery
      failure never breaks assignment (edge case: email undeliverable)
- [ ] T037 [US3] Implement reassign in `backend/src/events/service.ts` + route
      POST /api/events/:id/reassign (ADMIN only): deactivate prior Assignment, create
      new, REASSIGNED history entry, re-notify new technician (FR-017)
- [ ] T038 [P] [US3] Frontend: show `assignee {name, role}` on EventDetail and
      assignment info on list; `ReassignDialog.tsx` (ADMIN-only, user picker from
      GET /users) on `frontend/src/pages/EventDetail.tsx` (FR-017/FR-018)
- [ ] T039 [US3] Story green: T034 passes; UI create with on-duty technician shows
      ASSIGNED + assignee; empty roster shows OPEN/unassigned

---

## Phase 6: User Story 4 — Technician acknowledgement (P2)

**Goal**: assigned technician (or Admin) acknowledges an ASSIGNED event; status →
ACKNOWLEDGED with timestamp

**Independent Test**: assigned technician acknowledges → status/timestamp; different
technician → rejected; OPEN event → rejected

### Tests for User Story 4

- [ ] T040 [P] [US4] Contract test
      `backend/tests/contract/acknowledge.contract.test.ts`: assigned technician → 200
      ACKNOWLEDGED + acknowledgedAt + history ACKNOWLEDGED (FR-011, US4-1); different
      technician → 403 (US4-2); acknowledging OPEN event → 409 NOT_ASSIGNED (US4-3);
      double acknowledge → 409 (FR-006 single-status rule)

### Implementation for User Story 4

- [ ] T041 [US4] Implement acknowledge in `backend/src/events/service.ts` + route
      POST /api/events/:id/acknowledge: guard status==ASSIGNED (409), actor is
      assigned technician OR ADMIN (403), set status/acknowledgedAt + history entry
- [ ] T042 [US4] Frontend Acknowledge button on EventDetail (enabled for assigned
      technician/admin on ASSIGNED events); story green: T040 + UI walkthrough

---

## Phase 7: User Story 5 — Resolution (P2)

**Goal**: assigned technician (after acknowledging) or Admin resolves with mandatory
notes; status → RESOLVED with resolver + time

**Independent Test**: resolve acknowledged event with notes → RESOLVED; empty notes →
400; technician resolving pre-acknowledgement → 409 MUST_ACKNOWLEDGE_FIRST

### Tests for User Story 5

- [ ] T043 [P] [US5] Contract test
      `backend/tests/contract/resolve.contract.test.ts`: technician resolves
      ACKNOWLEDGED event with notes → 200 RESOLVED + resolvedBy/At/notes (US5-1);
      ADMIN resolves from OPEN/ASSIGNED → 200 (US5-2); empty/missing notes → 400
      (FR-013); technician resolving ASSIGNED event → 409 MUST_ACKNOWLEDGE_FIRST
      (clarify Q4-A, FR-012); VIEWER resolve → 403

### Implementation for User Story 5

- [ ] T044 [US5] Implement resolve in `backend/src/events/service.ts` + route
      POST /api/events/:id/resolve: notes non-empty (400); role path — technician:
      must be assignee AND status==ACKNOWLEDGED (409 otherwise); admin: any active
      status (403 for VIEWER/other technician); set resolvedBy/resolvedAt/notes +
      RESOLVED history (FR-012/013)
- [ ] T045 [US5] Frontend Resolve form on EventDetail (notes textarea required,
      client+server validation); story green: T043 + UI walkthrough per quickstart §3
      step 7

---

## Phase 8: User Story 6 — Lifecycle history (P3)

**Goal**: every transition retained and displayed chronologically with actor +
timestamp to every signed-in role

**Independent Test**: walk event create→assign→(reassign)→ack→resolve → detail shows
all entries in order

### Tests for User Story 6

- [ ] T046 [P] [US6] Contract test `backend/tests/contract/detail-history.contract.test.ts`:
      GET /api/events/:id returns full chronological history (CREATED, ASSIGNED,
      optional REASSIGNED, ACKNOWLEDGED, RESOLVED) each with actor UserDTO +
      createdAt (FR-014); visible to VIEWER (FR-015); 404 unknown id

### Implementation for User Story 6

- [ ] T047 [US6] Implement GET /api/events/:id in
      `backend/src/events/routes.ts` returning EventDetailDTO incl. history +
      reporter/assignee as UserDTO (no email) (FR-015/FR-018)
- [ ] T048 [P] [US6] Frontend EventDetail history timeline component
      (`frontend/src/pages/EventDetail.tsx`): ordered trail, actor name+role,
      timestamps, action badges (US6-1)
- [ ] T049 [US6] Story green: T046 + full lifecycle UI walkthrough (SC-004: 100% of
      transitions visible)

---

## Phase 9: Polish & Cross-Cutting

- [ ] T050 Contract-traceability sweep: map every FR-001…FR-019 to its passing test
      in `backend/tests/` — write the checklist into
      `specs/001-mvp-event-lifecycle/contracts/fr-coverage.md`; any FR without a
      test is a defect to fix now
- [ ] T051 Run quickstart.md §3 end-to-end manually (admin → user → temp password →
      roster → create → ack → resolve → negatives); fix any gap found
- [ ] T052 [P] README.md: point to quickstart.md, document the two dev URLs
      (http://localhost:3000/api, http://localhost:5173) and required `.env` keys
- [ ] T053 Full verification: `npm test` (all workspaces) green, `npm run lint` clean,
      `npx prisma migrate deploy` idempotent against both DATABASE_URL and
      TEST_DATABASE_URL — this is the convergence gate (constitution: verification &
      convergence)

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 (US1) — hard order: auth gates everything
- US2 (Phase 4) depends only on Phase 2 + US1 middleware
- US3 (Phase 5) depends on US2 (events exist to assign)
- US4 (Phase 6) depends on US3 (assignments exist)
- US5 (Phase 7) depends on US4 (acknowledgement gate it enforces)
- US6 (Phase 8) depends on US2 (events exist); US5 for a full trail
- Phase 9 last — convergence gate

## Parallel Execution Examples

- Within Phase 1: T003, T004, T005, T006, T007 all [P]
- Within Phase 2: T011+T012 (shared types), T014, T016, T017, T019 all [P] after T013
- Story tests (T021/T022, T029, T034, T040, T043, T046) are [P] within their phase —
  written FIRST (red), then implementation turns them green

## Implementation Strategy

- **MVP scope = Phases 1–5** (US1–US3): a signed-in user can report an event and the
  system routes it to an on-duty technician with an email — valuable standalone
- US4–US6 are independent increments on top; each keeps the suite green
- Every story ends verified (constitution: missing verification is not done)

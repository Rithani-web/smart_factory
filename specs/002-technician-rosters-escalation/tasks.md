# Tasks: Technician Rosters and Escalation Rules (spec/002)

**Prerequisites**: plan.md ✅ · spec.md ✅ (clarified 4/4) · research.md ✅ (D11–D15) · data-model.md ✅ · contracts/rest-api.md ✅ · quickstart.md ✅

**Tests**: REQUIRED (constitution gates); escalation timing uses injected clock only (FR-113).

## Phase 1: Schema & Shared Types (blocking)

- [x] T001 Update `backend/prisma/schema.prisma` per data-model.md: add
      RotationCadence enum, Team, TeamMembership (unique teamId+technicianId, dense
      position), EscalationPolicy (severity PK, windowMinutes Int?); extend
      ProductionEvent with ackDeadline DateTime? + escalationStep Int @default(0);
      add ESCALATED to HistoryAction; REMOVE DutyRosterEntry; run
      `npx prisma migrate dev --name spec002-rosters-escalation` and commit the migration
- [x] T002 [P] Extend `shared/types/src`: new `team.ts` (RotationCadence,
      TeamMemberDTO, TeamDTO, CreateTeamRequest/UpdateTeamRequest) and
      `escalation.ts` (EscalationPolicyDTO { severity, windowMinutes|null },
      PoliciesDTO, UpdatePoliciesRequest); add `'ESCALATED'` to HISTORY_ACTIONS in
      event.ts; re-export from index.ts (Constitution III)

## Phase 2: Rotation & Teams API

- [x] T003 Implement pure rotation math `backend/src/teams/rotation.ts`:
      `onDutyIndex(cadence, anchorAt, now, memberCount)` per data-model.md (floor
      elapsed/period mod count, clamp now<anchor → 0); exported for unit tests
- [x] T004 Unit test `backend/tests/unit/rotation.test.ts` (SC-102): weekly
      wrap-around ×3 cycles, daily cadence, now<anchor → 0, single member always 0 —
      synthetic dates only
- [x] T005 Implement `backend/src/teams/service.ts` + `routes.ts`: GET /api/teams
      (any role; members ordered by position; onDuty computed via T003;
      escalationAdmin included), POST /api/teams + PUT /api/teams/:id (ADMIN;
      validate cadence, ≥1 TECHNICIAN memberIds, positions dense) per
      contracts/rest-api.md
- [x] T006 Contract test `backend/tests/contract/teams.contract.test.ts`:
      VIEWER/TECHNICIAN read 200; writes 403 for VIEWER/TECHNICIAN (server-side,
      FR-104); ADMIN creates team with ordered members; on-duty reflects rotation
      anchor (US1-1/1-2 via API + injected anchor); 400 non-technician member;
      404 unknown id

## Phase 3: Assignment via rotation (spec/001 switch)

- [x] T007 Update `backend/src/events/service.ts` createEvent(): replace roster
      window query with first-team (createdAt asc) rotation resolution via T003; no
      team/members → OPEN unassigned (FR-105, US1-5)
- [x] T008 Update tests seeding to teams: `backend/tests/helpers.ts` gains
      `seedTeam(memberIds, {cadence, anchorAt})` replacing `addRosterEntry`; update
      spec/001 suites (assignment/acknowledge/resolve/detail-history) to use it;
      all spec/001 suites stay green (behavior assertions unchanged)
- [x] T009 Set acknowledgement deadline on assignment: in createEvent/reassign,
      look up EscalationPolicy for the severity; window → `ackDeadline =
      assignedAt + window`, `escalationStep = 0`; no window → `ackDeadline = null`
      (FR-106/107)

## Phase 4: Escalation policies API

- [x] T010 Implement `backend/src/escalation/policies.ts` + route entries:
      GET /api/escalation-policies (any role), PUT /api/escalation-policies (ADMIN,
      validate minutes ≥1 or null for all four severities); seed defaults in
      `backend/prisma/seed.ts` (CRITICAL 5, HIGH 15, MEDIUM 60, LOW null) (FR-106/114)
- [x] T011 Contract test `backend/tests/contract/policies.contract.test.ts`:
      any role reads; VIEWER/TECHNICIAN PUT → 403; ADMIN PUT applies (US3-1/2/3)

## Phase 5: Escalation evaluator (injectable clock)

- [x] T012 Implement `backend/src/escalation/evaluator.ts`:
      `runEscalationTick(now: Date = new Date(), db = getPrisma())` — find ASSIGNED
      events with ackDeadline < now; per event in one transaction: candidates =
      team members by position excluding current assignee; target =
      candidates[escalationStep mod len]; swap Assignment (active flags), status stays
      ASSIGNED, `ESCALATED` history (actor SYSTEM, detail from→to + window),
      notification via recordAndSend, `ackDeadline = now + window`,
      `escalationStep += 1`; exhausted candidates → designated admin (fallback
      lowest-id ADMIN), terminal `ackDeadline = null`; ackDeadline recomputation
      guarantees one escalation per deadline (FR-108/109/110/111, research D13/D15)
- [x] T013 Unit test `backend/tests/unit/escalation.test.ts` (mocked clock —
      synthetic dates, ZERO sleeps, FR-113): Critical assigned 6 min ago escalates to
      next member (US2-1); second deadline → third member; exhaustion → designated
      admin terminal (US2-2); acknowledged event never escalates (US2-3); LOW never
      (US2-4); RESOLVED never (US2-5); idempotent double-tick (one ESCALATED entry);
      single-member team → straight to admin; skip assignee/removed members
- [x] T014 Wire evaluator into `backend/src/server.ts`:
      `setInterval(() => runEscalationTick(), 30_000)` with error logging (research
      D11) — NOT started in app factory (tests call the tick directly)

## Phase 6: Polish & Verification

- [x] T015 Frontend: Teams view page (`frontend/src/pages/Teams.tsx` — list teams,
      ordered members, on-duty badge; ADMIN edit controls hidden otherwise),
      route in App.tsx, nav link; policies read-only display for all roles
- [x] T016 Full gate: `npm test` green (all suites old+new), `tsc --noEmit` clean
      both sides, eslint clean, `prisma migrate deploy` idempotent, quickstart §2–3
      walkthrough (real 5-min Critical escalation observed within one evaluator
      tick), FR-coverage matrix for FR-101…114 reported in completion output

## Dependencies

T001 → T002..T017; T003 → T004, T005, T007; T007+T009 → T012; T012 → T013; T014 after T012; T016 last.

## Implementation Strategy

Rotation math and the evaluator are pure/test-first; APIs are thin CRUD over them.
Spec/001 suites must stay green throughout (T008 is the regression gate).

# Tasks: SLA Targets & Tracking (spec/003)

**Prerequisites**: plan.md ✅ · spec.md ✅ (clarified 4/4) · research.md ✅ (D16–D20) · data-model.md ✅ · contracts/rest-api.md ✅ · quickstart.md ✅

**Tests**: REQUIRED; engine tests use injected clock only (FR-208) — zero sleeps.

## Phase 1: Schema, Types & Engine (blocking foundation)

- [ ] T001 Add SlaTarget model to `backend/prisma/schema.prisma` (severity PK,
      ackMinutes Int, resolveMinutes Int, both ≥1) per data-model.md; migrate via
      `prisma migrate diff` + `migrate deploy` (non-interactive pattern); commit migration
- [ ] T002 [P] Add `shared/types/src/sla.ts`: SlaStatus ('MET'|'BREACHED'|'PENDING'),
      SlaDimensionDTO { targetMinutes, actualMinutes, status }, SlaEvaluationDTO
      { acknowledge, resolve }, SlaTargetDTO, SlaTargetsDTO, UpdateSlaTargetsRequest;
      extend EventDTO with `slaBreached: boolean` and EventDetailDTO with
      `sla: SlaEvaluationDTO`; re-export from index.ts (Constitution III)
- [ ] T003 Engine tests `backend/tests/unit/sla-engine.test.ts` — write FIRST,
      synthetic timestamps, zero sleeps: the six mandatory scenarios (acked within /
      after SLA, resolved within / after SLA, still-open ack breach, still-open
      resolve breach) + boundary (elapsed == target → MET, +1 s → BREACHED) +
      PENDING + determinism (SC-201/SC-204)
- [ ] T004 Implement pure `backend/src/sla/engine.ts`
      `evaluateSla(event, targets, now)` per data-model.md semantics (D17/D18);
      turn T003 green

## Phase 2: Config API & wiring

- [ ] T005 Implement `backend/src/sla/service.ts` (get targets w/ constant fallback,
      update with ≥1 validation, severity→map batch helper) + `routes.ts`
      (GET any role / PUT ADMIN) mounted in `backend/src/app.ts`; seed defaults in
      `backend/prisma/seed.ts` (FR-201/202/210)
- [ ] T006 Contract test `backend/tests/contract/sla-targets.contract.test.ts`:
      defaults visible to every role; VIEWER/TECHNICIAN PUT → 403; ADMIN update
      visible to all; 400 on <1 minutes (US1-1/1-2/1-3)
- [ ] T007 Wire evaluation into event payloads: detail mapping adds
      `sla = evaluateSla(event, targets, now)`; list mapping adds compact
      `slaBreached` (batch target map, research D19) (FR-205/209)
- [ ] T008 Contract test `backend/tests/contract/event-sla.contract.test.ts`:
      back-dated createdAt CRITICAL event open 7 min → detail acknowledge BREACHED
      (FR-206); acked-within → MET with actual; list row flags slaBreached; every
      detail contains both dimensions

## Phase 3: Frontend & Gate

- [ ] T009 Frontend: SLA panel on `EventDetail.tsx` (both dimensions: target,
      actual, status chip MET/BREACHED/PENDING) + `slaBreached` ⚠ indicator on
      `EventsList.tsx` rows (FR-209)
- [ ] T010 Full gate: `npm test` green (all suites), `tsc --noEmit` clean both
      sides, eslint clean, FR-coverage matrix FR-201…210 in completion output,
      quickstart §3 walkthrough

## Dependencies

T001 → T005; T002 → T003/T004/T007; T003 → T004; T004+T005 → T007 → T008/T009; T010 last.

# Implementation Plan: SLA Targets & Tracking

**Branch**: `003-sla-targets` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

## Summary

Add per-severity SLA targets (time-to-acknowledge, time-to-resolve), Admin-configurable
with seeded defaults, and compute per-event SLA evaluation at read time — actual
durations plus MET/BREACHED/PENDING status for both dimensions, including live breach
status for still-open events. Evaluation is a pure function with an injected clock,
unit-tested on synthetic timestamps for the six mandatory scenarios plus boundaries.
No new dependencies or infrastructure; the event schema needs zero changes (report/
ack/resolve timestamps already exist).

## Technical Context

Unchanged from spec/001/002 (TS ESM monorepo, Express + Prisma + Neon, React + Vite +
Tailwind, Vitest + Supertest). **New**: `SlaTarget` table (one migration), pure
`evaluateSla` engine, config endpoints, DTO extension, UI badges.

## Constitution Check

| Principle | Gate | Status |
|-----------|------|--------|
| I. Spec-Driven Development | spec + clarified (4/4), checklist 16/16; implementation via tasks | ✅ PASS |
| II. Mandatory Server-Side Authorization | target writes ADMIN-only server-side; contract-tested | ✅ PASS |
| III. End-to-End TypeScript Types | SlaTargetDTO/SlaEvaluationDTO in shared/types, consumed by both sides | ✅ PASS |
| IV. Single Source of Truth for Schema | one migration adds SlaTarget; evaluation computed, never stored per event | ✅ PASS |
| V. Secure Authentication by Default | no auth changes | ✅ PASS |
| VI. Course Fidelity & Simplicity | no new tech; pure function + one table is exactly the briefed scope | ✅ PASS |

## Project Structure

```text
backend/src/sla/
├── engine.ts               # evaluateSla(input, now) — pure, injected clock (FR-208)
├── service.ts              # get/update targets; defaults; batch map for lists
└── routes.ts               # GET /api/sla-targets (any) · PUT (ADMIN)
backend/prisma/schema.prisma # +SlaTarget (severity PK, ackMinutes, resolveMinutes)
shared/types/src/sla.ts      # SlaStatus, SlaDimensionDTO, SlaEvaluationDTO, target DTOs
frontend/src/…               # SLA badges on EventDetail; breach indicator on list
```

Design artifacts: [research.md](./research.md) · [data-model.md](./data-model.md) ·
[contracts/rest-api.md](./contracts/rest-api.md) · [quickstart.md](./quickstart.md)

## Complexity Tracking

No constitution violations — table intentionally empty.

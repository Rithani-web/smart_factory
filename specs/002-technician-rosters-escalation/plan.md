# Implementation Plan: Technician Rosters and Escalation Rules

**Branch**: `002-technician-rosters-escalation` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

## Summary

Extend the existing monorepo with rotation-based on-call teams and a severity-driven
escalation engine. Teams hold an ordered technician list with WEEKLY/DAILY rotation and
an anchor date; "on duty" is pure rotation math. Escalation policies map severity →
window minutes (CRITICAL 5 / HIGH 15 / MEDIUM 60 / LOW never). An in-process evaluator
with an **injectable clock** reassigns unacknowledged ASSIGNED events to the next
technician in rotation order, terminally to a designated Admin, logging `ESCALATED`
on the existing lifecycle history. Assignment (spec/001) switches to rotation teams;
the window-based roster table is dropped.

## Technical Context

Unchanged from spec/001 (TypeScript ESM monorepo, Express + Prisma + Neon, React +
Vite + Tailwind, Vitest + Supertest, JWT httpOnly cookies, Resend behind Mailer seam).

**New in this spec**: no new dependencies, no new infrastructure — the evaluator is an
in-process interval owned by `server.ts`, and the clock is a parameter
(research D11).

## Constitution Check

| Principle | Gate | Status |
|-----------|------|--------|
| I. Spec-Driven Development | spec/002 specified + clarified (4/4 answers integrated, checklist 16/16) | ✅ PASS |
| II. Mandatory Server-Side Authorization | team/policy writes ADMIN-only server-side; contract tests assert 403s | ✅ PASS |
| III. End-to-End TypeScript Types | TeamDTO/PolicyDTO/etc. added to `shared/types`, consumed by both sides | ✅ PASS |
| IV. Single Source of Truth for Schema | one Prisma migration extends the schema (adds Team/TeamMembership/EscalationPolicy, event escalation fields, drops DutyRosterEntry) | ✅ PASS |
| V. Secure Authentication by Default | no auth changes; escalation notifications reuse existing path | ✅ PASS |
| VI. Course Fidelity & Simplicity | no new tech — in-process evaluator + parameter-injected clock is exactly what the course's spec/002 requires (mocked-time tests) | ✅ PASS |

## Project Structure

```text
backend/src/
├── teams/                  # rotation math (pure fn), service, routes (GET any, writes ADMIN)
├── escalation/
│   ├── policies.ts         # severity → window storage/read
│   └── evaluator.ts        # runEscalationTick(now, db?) — injectable clock, idempotent
├── events/service.ts       # assignment now resolves via team rotation
backend/prisma/schema.prisma # +Team, TeamMembership, EscalationPolicy; +event escalation fields; -DutyRosterEntry
shared/types/src/           # +team.ts, +escalation.ts; HistoryAction + ESCALATED
```

Design artifacts: [research.md](./research.md) · [data-model.md](./data-model.md) ·
[contracts/rest-api.md](./contracts/teams-and-policies.md) ·
[quickstart.md](./quickstart.md)

## Complexity Tracking

No constitution violations — table intentionally empty.

# Research: Technician Rosters and Escalation Rules (spec/002)

## D11. Time handling: injectable clock, no scheduler framework

- **Decision**: rotation math and the escalation evaluator take `now: Date` as a
  parameter. The evaluator (`runEscalationTick(now?)`) is exported and unit-tested with
  synthetic dates; production wires a 30-second `setInterval` in `server.ts` only.
- **Rationale**: satisfies the spec's mocked-time requirement (FR-113) with zero new
  dependencies; the tick function stays a pure-ish transactional unit.
- **Alternatives considered**: node-cron / BullMQ (new tech — forbidden by
  Constitution VI); sleeping in tests (explicitly forbidden by the spec).

## D12. Rotation math: pure function

- **Decision**: `rotationPosition({ cadence, anchorAt, now, memberCount }) → index` —
  `floor((now − anchor) / periodMs) mod memberCount` (periodMs = 7d or 24h, UTC).
  Negative (now < anchor) clamps to 0. Extracted as a pure function for direct unit
  tests (SC-102: 3 wrap-around cycles).
- **Alternatives considered**: date-fns calendar-week logic (dependency + ambiguity
  about week boundaries; elapsed-period math is deterministic and testable).

## D13. Escalation state on the event row

- **Decision**: three nullable/defaulted columns on `ProductionEvent`:
  `ackDeadline` (null = no policy / acknowledged / terminal), `escalationStep`
  (hops consumed for the current deadline), and reusing `ackDeadline` itself for
  idempotency — after an escalation the deadline is recomputed to `now + window`
  (future), so the same deadline can never fire twice (FR-111). Terminal admin
  escalation sets `ackDeadline = null`.
- **Alternatives considered**: separate EscalationState table (extra joins for data
  that is 1:1 with the event); a jobs queue (new infrastructure).

## D14. Superseding the window roster

- **Decision**: migration drops `DutyRosterEntry`; `createEvent` resolves the assignee
  via the first team's current rotation position. Tests that seeded roster windows are
  updated to seed a team instead (spec/001 behavior assertions unchanged).
- **Rationale**: clarified Q1 — single source of truth (Constitution IV).

## D15. Escalation target selection

- **Decision**: candidate order = current team members ordered by position, excluding
  the current assignee; target = `candidates[(escalationStep) mod candidates.length]`;
  empty candidates (single-member team or all others removed) → designated team Admin
  (fallback: lowest-id ADMIN). Terminal: after admin escalation, `ackDeadline = null`.
- **Rationale**: matches clarified Q4 and the spec's edge cases (skip assignee, skip
  removed members, single-member → admin).

# Data Model: Technician Rosters and Escalation Rules (spec/002)

Extends spec/001's model (data-model authority remains `backend/prisma/schema.prisma`).

## Removed

- **DutyRosterEntry** — dropped by migration (clarified Q1: rotation teams replace it).

## New enums

- **RotationCadence**: `WEEKLY` | `DAILY`

## New models

### Team

| Field | Type | Rules |
|---|---|---|
| id | String (cuid) | PK |
| name | String | non-empty, unique |
| cadence | RotationCadence | WEEKLY or DAILY |
| anchorAt | DateTime | rotation position 0 starts here (UTC) |
| escalationAdminId | String? → User (ADMIN) | designated Production Manager; fallback = lowest-id ADMIN |
| createdAt | DateTime | first team by createdAt = assignment source |

### TeamMembership

| Field | Type | Rules |
|---|---|---|
| id | String (cuid) | PK |
| teamId | → Team | |
| technicianId | → User (TECHNICIAN) | unique per team |
| position | Int | 0-based, dense, ordered |

### EscalationPolicy

| Field | Type | Rules |
|---|---|---|
| severity | Severity (PK) | one row per severity |
| windowMinutes | Int? | null = never escalates. Seeded: CRITICAL 5, HIGH 15, MEDIUM 60, LOW null |

## Extended: ProductionEvent

| Field | Type | Rules |
|---|---|---|
| ackDeadline | DateTime? | set at assignment/reassign when the severity has a window; cleared on acknowledge and on terminal admin escalation |
| escalationStep | Int, default 0 | escalation hops consumed for the current deadline; reset to 0 on new assignment |

### HistoryAction

Extended with `ESCALATED` (migration: ALTER TYPE ADD VALUE). Detail format:
`"<fromName> → <toName> (SEVERITY unacknowledged <window>m)"`, actor = SYSTEM user.

## Rotation & deadline math

- On-duty index: `floor((now − anchorAt) / periodMs) mod members.length`
  (periodMs: WEEKLY = 604_800_000, DAILY = 86_400_000; now < anchor → index 0).
- Assignment: first team (createdAt asc) → member at on-duty index.
- Escalation: candidates = members by position, excluding current assignee;
  target = `candidates[escalationStep mod candidates.length]`; none → designated
  admin (terminal, `ackDeadline = null`). Otherwise: reassign + `ESCALATED` history +
  notification + `ackDeadline = now + window`, `escalationStep += 1`.

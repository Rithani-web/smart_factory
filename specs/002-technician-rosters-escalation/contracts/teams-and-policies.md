# REST API Contract: Teams & Escalation Policies (spec/002)

Base and error semantics unchanged (see spec/001 contracts). New endpoints, all under
`/api`, all requiring authentication (401 unauthenticated) and the pending-password gate.

## Teams

### `GET /teams` *(any signed-in role)*
→ **200** `[{ id, name, cadence, anchorAt, members: [{ id, name, role, position }],
onDuty: { id, name, role } | null, escalationAdmin: { id, name, role } | null }]`
(ordered by createdAt; members ordered by position)

### `POST /teams` *(ADMIN)*
Body: `{ name, cadence: "WEEKLY"|"DAILY", anchorAt: ISO, memberIds: string[] (ordered,
all TECHNICIAN, ≥1), escalationAdminId?: string }`
→ **201** TeamDTO · **400** validation (bad cadence / empty or non-technician members) ·
**403** non-admin

### `PUT /teams/:id` *(ADMIN)*
Same body (full replace of mutable fields incl. member order) → **200** TeamDTO ·
**404** unknown id

## Escalation policies

### `GET /escalation-policies` *(any signed-in role)*
→ **200** `{ policies: [{ severity, windowMinutes | null }] }` (all four severities)

### `PUT /escalation-policies` *(ADMIN)*
Body: `{ windows: { CRITICAL: number|null, HIGH: number|null, MEDIUM: number|null,
LOW: number|null } }` (minutes ≥ 1 or null)
→ **200** updated policies · **400** validation · **403** non-admin

## Behavior contracts (tested)

- New-event assignment resolves via the first team's current rotation (US1-1/1-2).
- No team / empty team → event stays OPEN, `unassigned: true` (US1-5, FR-105).
- `runEscalationTick(now)` with `now = assignment + window + ε` escalates to the next
  rotation candidate: assignment swapped, `ESCALATED` history entry (actor SYSTEM),
  notification recorded, `ackDeadline` recomputed (FR-108/110, FR-111 idempotency).
- Rotation exhausted → designated admin (terminal, `ackDeadline = null`) (FR-109).
- Acknowledged / RESOLVED / window-less (LOW) events are never escalated (FR-112).
- All timing via injected `now` — zero sleeps in tests (FR-113).

## RBAC matrix additions

| Endpoint | VIEWER | TECHNICIAN | ADMIN |
|---|---|---|---|
| GET /teams, GET /escalation-policies | 200 | 200 | 200 |
| POST/PUT /teams | 403 | 403 | 200/201 |
| PUT /escalation-policies | 403 | 403 | 200 |

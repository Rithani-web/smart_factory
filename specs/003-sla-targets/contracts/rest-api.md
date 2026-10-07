# REST API Contract: SLA Targets & Event SLA Evaluation (spec/003)

Base URL, auth, error shape unchanged (spec/001 contracts). All endpoints require
authentication (401) and honor the pending-password gate.

## SLA targets

### `GET /sla-targets` *(any signed-in role)*
→ **200** `{ targets: [{ severity, ackMinutes, resolveMinutes }] }` — all four
severities, defaults when unconfigured (FR-201/202)

### `PUT /sla-targets` *(ADMIN)*
Body: `{ targets: { CRITICAL: { ackMinutes, resolveMinutes }, HIGH?: …, MEDIUM?: …,
LOW?: … } }` (minutes ≥ 1)
→ **200** full updated target list · **400** validation · **403** non-admin (FR-210)

## Event payloads (spec/001 endpoints extended)

- `GET /api/events/:id` → EventDetailDTO gains
  `sla: { acknowledge: { targetMinutes, actualMinutes, status }, resolve: { … } }`
  with status ∈ `MET | BREACHED | PENDING` (FR-205)
- `GET /api/events` → EventDTO gains compact `slaBreached: boolean` (FR-209)

## Behavior contracts (tested)

- Mocked-clock engine suite: six mandatory scenarios + boundaries — `elapsed ==
  target` → MET, `+1 s` → BREACHED; PENDING for not-yet-due; zero sleeps (FR-208).
- Open event with back-dated `createdAt` (7 min ago, CRITICAL): API detail shows
  `acknowledge.status = BREACHED` without acknowledgement (FR-206).
- Acknowledged within/after target → MET/BREACHED with correct actual (US2-1/2-2).
- Target update by ADMIN visible to all roles; VIEWER/TECHNICIAN PUT → 403 (US1-*).

## RBAC matrix additions

| Endpoint | VIEWER | TECHNICIAN | ADMIN |
|---|---|---|---|
| GET /sla-targets | 200 | 200 | 200 |
| PUT /sla-targets | 403 | 403 | 200 |

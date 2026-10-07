# REST API Contract: Dashboard & Public Status (spec/004)

Error semantics unchanged. NEW UNAUTHENTICATED surface is limited to
`GET /api/public/status` (constitution v1.3.0); everything else stays behind auth +
pending-password gates.

## Public (NO auth)

### `GET /api/public/status`
→ **200** `{ serverTime, teams: [{ teamId, teamName, derivedStatus, finalStatus,
manualOverride: { message, authorName, createdAt } | null, openCounts:
{ CRITICAL, HIGH, MEDIUM, LOW } }] }` — teams ordered by name; payload contains no
emails or assignee identities (asserted by test, FR-311).

## Authenticated

### `GET /api/dashboard/summary?teamId=&days=7|30|90` *(any role)*
→ **200** `{ openBySeverity: {CRITICAL,HIGH,MEDIUM,LOW}, teams: [{ id, name, onDuty:
{name} | null }], sla: { total, met, rate }, volume: [{ date: 'YYYY-MM-DD', count }],
appliedFilter: { teamId | null, days } }`
- Admin default: all teams. Non-admin default (no teamId): teams they are a member of
  (fallback all) — FR-302; filters are read-only for every role.

### `PUT /api/teams/:id/status-message` *(ADMIN)*
Body: `{ message: string }` (1–280 chars) → **200** `{ override: {message, authorName,
createdAt}, derivedStatus }` · **400** validation · **403** non-admin · **404**

### `DELETE /api/teams/:id/status-message` *(ADMIN)*
→ **204** (override cleared; derived status resumes) · **403** · **404**

## Behavior contracts (tested)

- Derived mapping matrix: none/LOW/MEDIUM/HIGH/CRITICAL open sets → the four statuses
  (FR-304); override wins and is marked (FR-305).
- Public endpoint 200 unauthenticated; payload scanned: no `@` emails, no assignee
  names (FR-303/311).
- Dashboard math vs seeded fixture: counts, on-duty, 8/10=80% compliance, bucket sums
  (SC-301); non-admin default filter = membership (US1-4).
- RBAC edges: new admin routes 403/401; pending-password gate applies (FR-311).

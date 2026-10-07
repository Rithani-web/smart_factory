# REST API Contract: MVP Production Event Lifecycle (spec/001)

Base URL (dev): `http://localhost:3000/api` — JSON everywhere. Auth via HTTP-only
cookies (access + refresh; D2). Person data in every response is `{ id, name, role }`
only — emails never appear (FR-018).

**Error shape** (all errors, D9): `{"error": {"code": string, "message": string}}`
**Status codes**: 400 validation · 401 unauthenticated · 403 permission denied (incl.
`PASSWORD_CHANGE_REQUIRED`) · 404 unknown id · 409 lifecycle violation

## Auth

### `POST /auth/login`
Body: `{ "email": string, "password": string }`
→ **200** `{ "user": { id, name, role, mustChangePassword } }` + sets both cookies
→ **401** `INVALID_CREDENTIALS`

### `POST /auth/refresh`
→ **200** new access cookie (valid refresh cookie required) · **401** otherwise

### `POST /auth/logout`
→ **204** clears both cookies

### `POST /auth/complete-password-change` *(auth required)*
Body: `{ "newPassword": string }` (min 8 chars)
→ **204** clears `mustChangePassword` · **403** `PASSWORD_CHANGE_REQUIRED` is the gate:
while it is set, **every other authenticated endpoint returns 403 `PASSWORD_CHANGE_REQUIRED`**
(D10 / FR-019)

## Events

### `GET /events` *(any signed-in role)*
→ **200** `[{ id, title, severity, status, machineRef, createdAt }]` — newest first.
Open + unassigned events are visible at a glance (SC-006).

### `GET /events/:id` *(any signed-in role)*
→ **200** full detail: list fields + `description` + `reporter: {id,name,role}` +
`assignee: {id,name,role} | null` + `acknowledgedAt` + `resolvedAt` +
`resolutionNotes` + `history: [{ action, actor: {id,name,role}, detail, createdAt }]`
chronological (FR-014/FR-015) · **404**

### `POST /events` *(ADMIN, TECHNICIAN)*
Body: `{ "title": string, "description": string, "machineRef": string,
"severity": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL" }`
→ **201** EventDetailDTO — creation transaction: insert event (OPEN) → find on-duty
technician (roster covers now, roster order, D5) → if found: create Assignment + status
`ASSIGNED` + `ASSIGNED` history entry + dispatch email notification (attempt recorded,
FR-009/FR-010); if none: stays `OPEN`, no assignment, response carries
`unassigned: true` (FR-008) · **400** validation (missing field / bad severity)

### `POST /events/:id/acknowledge`
Actor: the **assigned technician** or **ADMIN** (FR-011)
→ **200** EventDetailDTO (status `ACKNOWLEDGED`, `acknowledgedAt` set, history entry)
→ **403** wrong actor · **409** `NOT_ASSIGNED` (status ≠ `ASSIGNED`)

### `POST /events/:id/resolve`
Actor: assigned **TECHNICIAN** (from `ACKNOWLEDGED` only) or **ADMIN** (from any active
status) (FR-012)
Body: `{ "resolutionNotes": string }` — non-empty required (FR-013)
→ **200** EventDetailDTO (status `RESOLVED`, resolver + time + notes recorded)
→ **400** missing/empty notes · **403** wrong actor · **409**
`MUST_ACKNOWLEDGE_FIRST` (technician, status ≠ `ACKNOWLEDGED`)

### `POST /events/:id/reassign`
Actor: **ADMIN** only (FR-017) — event in `OPEN`, `ASSIGNED`, or `ACKNOWLEDGED`
Body: `{ "technicianId": string }` (target must be a TECHNICIAN)
→ **200** EventDetailDTO (prior assignment deactivated, new Assignment active,
`REASSIGNED` history entry; re-notification dispatched to the new technician and
recorded) · **403** non-admin · **404** unknown technicianId

## Users *(ADMIN only)*

### `POST /users`
Body: `{ "name": string, "email": string, "role": "ADMIN"|"TECHNICIAN"|"VIEWER" }`
→ **201** `{ "user": { id, name, role }, "temporaryPassword": string }` — temp password
shown exactly once; user has `mustChangePassword = true` (FR-019, D10) · **400**
validation · **409** `EMAIL_TAKEN`

### `GET /users` *(ADMIN only)*
→ **200** `[{ id, name, role }]` — supports the reassign picker · **403** non-admin

## RBAC matrix (server-enforced — Constitution II; every cell is a contract test)

| Endpoint | Unauth | VIEWER | TECHNICIAN | ADMIN |
|---|---|---|---|---|
| POST /auth/login | ✅ | — | — | — |
| GET /events, GET /events/:id | 401 | 200 | 200 | 200 |
| POST /events | 401 | 403 | 201 | 201 |
| acknowledge | 401 | 403 | 200 if assigned · 403 else | 200 (from ASSIGNED) |
| resolve | 401 | 403 | 200 if assigned+ack'd · 403/409 | 200 (any active) |
| reassign | 401 | 403 | 403 | 200 |
| POST /users, GET /users | 401 | 403 | 403 | 200/201 |
| any endpoint while `mustChangePassword` | — | 403 PASSWORD_CHANGE_REQUIRED | 〃 | 〃 (except password-change) |

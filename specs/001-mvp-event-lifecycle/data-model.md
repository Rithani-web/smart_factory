# Data Model: MVP Production Event Lifecycle (spec/001)

Authoritative source: `backend/prisma/schema.prisma` (Constitution IV — this document
describes it; it never duplicates it). All timestamps UTC. IDs: Prisma `cuid` defaults.

## Enums

- **Role**: `ADMIN` | `TECHNICIAN` | `VIEWER`
- **Severity**: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL` (FR-005 — exactly these four)
- **EventStatus**: `OPEN` | `ASSIGNED` | `ACKNOWLEDGED` | `RESOLVED` (FR-006)
- **NotificationStatus**: `SENT` | `FAILED`
- **HistoryAction**: `CREATED` | `ASSIGNED` | `REASSIGNED` | `ACKNOWLEDGED` |
  `RESOLVED`

## Entities

### User

An account. Email is internal-only (sign-in + notification delivery) — never exposed in
any API DTO or view (FR-018).

| Field | Type | Rules |
|---|---|---|
| id | String (cuid) | PK |
| name | String | non-empty |
| email | String | unique, non-empty |
| passwordHash | String | bcrypt hash, never leaves the DB |
| role | Role | default `VIEWER` |
| mustChangePassword | Boolean | default `true` on admin provisioning (FR-019, D10) |
| createdAt | DateTime | auto |

Relations: reported events (`ProductionEvent.reporterId`), assignments, roster entries,
notifications (recipient), history entries (actor), resolutions (`resolvedById`).

### ProductionEvent

The central record.

| Field | Type | Rules |
|---|---|---|
| id | String (cuid) | PK |
| title | String | non-empty (FR-004) |
| description | String | non-empty |
| machineRef | String | non-empty free-text reference (spec assumption — no machine registry) |
| severity | Severity | FR-005 |
| status | EventStatus | default `OPEN`; exactly one at all times (FR-006) |
| reporterId | → User | creation time and reporter always recorded (FR-006) |
| resolvedById | → User? | set at resolution |
| resolutionNotes | String? | MUST be non-empty when status = `RESOLVED` (FR-013) |
| acknowledgedAt | DateTime? | set at acknowledgement |
| resolvedAt | DateTime? | set at resolution |
| createdAt | DateTime | auto |

**State transitions** (illegal transitions are rejected with 409 — D9):

| From | Action (actor) | To |
|---|---|---|
| — (creation) | create (ADMIN, TECHNICIAN) | `OPEN` → auto-assign → `ASSIGNED` if on-duty tech exists, else stays `OPEN` (FR-007/FR-008) |
| `OPEN` | admin reassign (ADMIN, FR-017) | `OPEN` → `ASSIGNED` |
| `ASSIGNED` | acknowledge (assigned TECHNICIAN or ADMIN — FR-011) | `ASSIGNED` → `ACKNOWLEDGED` (+ `acknowledgedAt`) |
| `ASSIGNED` | admin reassign (FR-017) | stays `ASSIGNED`, new assignment |
| `ASSIGNED` | resolve (**ADMIN only** until acknowledged — FR-012) | → `RESOLVED` |
| `ACKNOWLEDGED` | reassign (ADMIN, FR-017) | stays `ACKNOWLEDGED`, new assignment |
| `ACKNOWLEDGED` | resolve (assigned TECHNICIAN or ADMIN — FR-012) | → `RESOLVED` (+ `resolvedAt`, notes) |

Denied: acknowledge from any status ≠ `ASSIGNED` (409); technician resolve from
`OPEN`/`ASSIGNED` (409); any action by a non-permitted role (403).

### Assignment

Links an event to the technician responsible. History preserves prior assignments.

| Field | Type | Rules |
|---|---|---|
| id | String (cuid) | PK |
| eventId | → ProductionEvent | |
| technicianId | → User (TECHNICIAN) | |
| assignedAt | DateTime | auto |
| active | Boolean | exactly one `true` per event; reassignment sets prior → `false` (FR-017) and creates a new row + `REASSIGNED` history entry |

### DutyRosterEntry

Minimal roster for spec/001 — answers only "who is on duty now". Full roster/escalation
rules arrive in spec/002.

| Field | Type | Rules |
|---|---|---|
| id | String (cuid) | PK |
| technicianId | → User (TECHNICIAN) | |
| startsAt / endsAt | DateTime | "on duty now" = window containing `now` |

### Notification

Every outbound notification attempt, recorded (FR-009/FR-010) — including failures.

| Field | Type | Rules |
|---|---|---|
| id | String (cuid) | PK |
| eventId | → ProductionEvent | |
| recipientId | → User | |
| channel | String | `"email"` in MVP |
| status | NotificationStatus | `SENT` / `FAILED` |
| error | String? | delivery failure detail when `FAILED` |
| sentAt | DateTime | attempt time |

### HistoryEntry

The event's lifecycle trail (FR-014) — chronological, actor-stamped.

| Field | Type | Rules |
|---|---|---|
| id | String (cuid) | PK |
| eventId | → ProductionEvent | |
| action | HistoryAction | |
| actorId | → User | |
| detail | String? | e.g. technician name on `ASSIGNED`/`REASSIGNED`; notes snapshot on `RESOLVED` |
| createdAt | DateTime | auto |

## Derived / exposure rules

- **UserDTO** (both API responses and views): `{ id, name, role }` — **never** `email`,
  never `passwordHash` (FR-018).
- **EventDTO** (list): `{ id, title, severity, status, machineRef, createdAt }`.
- **EventDetailDTO**: EventDTO + description + reporter/assignee as UserDTO +
  acknowledgedAt/resolvedAt/resolutionNotes + full history array.
- Unassigned events are `status = OPEN` with no active assignment — list-renderable at a
  glance (SC-006).

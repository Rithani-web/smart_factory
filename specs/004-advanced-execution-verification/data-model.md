# Data Model: Dashboard, Public Status Page & Hardening (spec/004)

One new table; all dashboard/status figures are computed at request time.

## New model

### StatusMessage

| Field | Type | Rules |
|---|---|---|
| id | String (cuid) | PK |
| teamId | String, unique | at most one active message per team (clarified Q5) |
| team | → Team | |
| message | String | non-empty, ≤ 280 chars |
| authorId | → User | display name exposed on the public page |
| createdAt | DateTime | set on create/replace |

Clearing = delete the row (derived status resumes). No history of overrides is kept
in this spec (out of scope).

## Computed payloads (no storage)

- **Derived team status**: max open-event severity per team → OPERATIONAL /
  DEGRADED / PARTIAL_OUTAGE / MAJOR_OUTAGE (D21).
- **Dashboard summary**: open counts by severity; per-team on-duty via rotation
  (spec/002); SLA compliance = MET-both / due-total for events created in the window
  (PENDING excluded from denominator); volume = UTC-day buckets of created events.
- **Public payload**: team name, derived + final status, open counts, active override
  {message, authorName, createdAt}, server timestamp — no personal data.

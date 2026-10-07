# Data Model: SLA Targets & Tracking (spec/003)

Authority remains `backend/prisma/schema.prisma`. One new table; **zero changes to
ProductionEvent** (evaluation is computed — research D16).

## New model

### SlaTarget

| Field | Type | Rules |
|---|---|---|
| severity | Severity (PK) | one row per severity |
| ackMinutes | Int | ≥ 1 — time-to-acknowledge target |
| resolveMinutes | Int | ≥ 1 — time-to-resolve target |

Seeded defaults (clarified Q1): CRITICAL 5/60 · HIGH 15/240 · MEDIUM 60/480 ·
LOW 240/1440. Service falls back to identical constants when rows are absent.

## Reused event fields (inputs to evaluation)

- `createdAt` — report time (measurement origin, clarified Q3)
- `acknowledgedAt` — set by spec/001 acknowledge flow
- `resolvedAt` — set by spec/001 resolve flow

## Evaluation semantics (pure, research D17/D18)

For dimension `acknowledge` with target `T_ack`:

- acknowledged → status `MET` if `acknowledgedAt − createdAt ≤ T_ack`, else `BREACHED`;
  actual = elapsed minutes (1 decimal)
- not acknowledged → if `now − createdAt > T_ack` → `BREACHED` (actual = live elapsed),
  else `PENDING`

Identical for `resolve` with `resolvedAt` / `T_resolve`. Boundary: elapsed exactly
equal to target = `MET` (FR-208, US3-2/3-3).

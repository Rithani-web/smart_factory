# Research: SLA Targets & Tracking (spec/003)

## D16. Computed at read time, never stored

- **Decision**: SLA status is derived per API read from `createdAt`/`acknowledgedAt`/
  `resolvedAt` + current targets + `now`. Nothing SLA-related is persisted on events.
- **Rationale**: FR-206/207 demand live breach status against current/injectable time;
  storing status would freeze it and drift from target edits. Storage = 1 config table
  total (Constitution IV — no per-event duplication).
- **Alternatives considered**: persisted status columns updated by a ticker (drift,
  migration weight, and a second evaluator to maintain).

## D17. Pure engine with injected clock

- **Decision**: `evaluateSla({ createdAt, acknowledgedAt, resolvedAt }, targets, now)`
  → `{ acknowledge: { targetMinutes, actualMinutes, status }, resolve: { … } }` — no DB,
  no clock reads inside. Boundary: `elapsedMs == targetMs` → MET; anything beyond →
  BREACHED; not yet due and not done → PENDING.
- **Rationale**: FR-208's six mandatory scenarios plus boundaries become instant unit
  tests on synthetic timestamps; DTO mapping supplies `now = new Date()` in production.
- **Alternatives considered**: testing through the API with backdating only (covers
  integration but not boundary precision nor determinism — SC-204).

## D18. Status vocabulary

- **Decision**: per dimension — `MET` (done within target), `BREACHED` (done late OR
  still open and past target), `PENDING` (not done, not yet due).
- **Rationale**: three states disambiguate "no breach possible yet" from "met", which
  a boolean cannot; the UI maps PENDING → neutral, MET → green, BREACHED → red.

## D19. List evaluation cost

- **Decision**: list endpoint fetches the four target rows once per call and evaluates
  per event in memory (O(n) pure math); events expose a compact `slaBreached` flag;
  detail exposes the full evaluation object.
- **Rationale**: satisfies FR-209's list indicator without an N+1 or storing status.

## D20. Defaults (clarified Q1)

CRITICAL 5/60 · HIGH 15/240 · MEDIUM 60/480 · LOW 240/1440 (ack/resolve minutes).
Seeded on migration-adjacent seed run; service also falls back to these constants when
rows are absent (targets are always total).

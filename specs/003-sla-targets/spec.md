# Feature Specification: SLA Targets & Tracking (Advanced Production Automation)

**Feature Branch**: `003-sla-targets`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Each Production Event severity level must have a
configurable SLA target for Time-to-Acknowledge and Time-to-Resolve. SLA targets are
Admin configurable with sensible defaults per severity. For every event the system
computes and displays actual time-to-acknowledge and time-to-resolve, and whether each
SLA was met or breached. For still-open events, SLA status must show as breached once
exceeded, based on current/injectable time, without requiring resolution. SLA
calculation logic must have unit tests using injectable/mocked time — not real
waiting — covering at minimum: acknowledged within SLA, acknowledged after SLA,
resolved within SLA, resolved after SLA, still-open with ack SLA breached, still-open
with resolve SLA breached. Same architecture, stack, SDD methodology, Spec Kit
workflow; existing severity model and terminology."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin-configurable SLA targets (Priority: P1)

An Admin sets, per severity level (Low/Medium/High/Critical), two SLA targets in
minutes: time-to-acknowledge and time-to-resolve. Sensible defaults exist out of the
box. Every signed-in role can VIEW the effective targets; only Admins can change them
(server-enforced, consistent with teams/policies management in spec/002).

**Why this priority**: targets are the yardstick — nothing can be evaluated as
met/breached until they exist.

**Independent Test**: change the Critical acknowledge target as Admin, verify a Viewer
sees the new value, verify a Technician's write attempt is rejected.

**Acceptance Scenarios**:

1. **Given** defaults only, **When** any signed-in role requests SLA targets, **Then**
   all four severities report both targets.
2. **Given** an Admin, **When** they update the Critical acknowledge target, **Then**
   the new value is returned to every role on the next read.
3. **Given** a Technician or Viewer, **When** attempting to update targets, **Then**
   the action is rejected server-side.

---

### User Story 2 - SLA computation and display per event (Priority: P1)

For every production event, the system evaluates SLA status for both dimensions and
exposes it alongside the event:

- **time-to-acknowledge**: once acknowledged, the actual elapsed time
  (report → acknowledgement) and whether it met the severity's target.
- **time-to-resolve**: once resolved, the actual elapsed time (report → resolution)
  and whether it met the target.
- **Still-open events**: the acknowledgement SLA reads **breached** as soon as the
  target elapses without acknowledgement; likewise the resolution SLA reads **breached**
  once its target elapses without resolution — evaluation uses the current time, so no
  resolution or acknowledgement is needed for a breach to show.

SLA status appears in the event detail view (and list rows), using clear met/breach
indicators with actual durations.

**Why this priority**: this is the feature's core value — making service levels
visible per event.

**Independent Test**: with a Critical acknowledge target of 5 minutes, an event
acknowledged 3 minutes after reporting shows "ack SLA met (3m)"; one acknowledged
after 6 minutes shows "ack SLA breached (6m)"; an unacknowledged event evaluated 7
minutes after reporting shows the acknowledge SLA breached — all with a synthetic
clock.

**Acceptance Scenarios**:

1. **Given** an event acknowledged 3 minutes after reporting with a 5-minute target,
   **When** its SLA is evaluated, **Then** actual = 3 minutes and the acknowledge SLA
   reads met.
2. **Given** an event acknowledged 6 minutes after reporting with a 5-minute target,
   **When** evaluated, **Then** the acknowledge SLA reads breached with actual = 6
   minutes.
3. **Given** an event resolved 50 minutes after reporting with a 60-minute resolve
   target, **When** evaluated, **Then** the resolve SLA reads met (actual = 50m).
4. **Given** an event resolved after the resolve target elapsed, **When** evaluated,
   **Then** the resolve SLA reads breached.
5. **Given** a still-open event reported 7 minutes ago with a 5-minute ack target,
   **When** evaluated at now, **Then** the acknowledge SLA reads breached even though
   the event was never acknowledged.
6. **Given** a still-open (unresolved) event reported 2 days ago with a 24-hour
   resolve target, **When** evaluated at now, **Then** the resolve SLA reads breached.

---

### User Story 3 - SLA evaluation engine with mocked-time tests (Priority: P2)

The SLA evaluation is a pure, deterministic function of (report time, acknowledgement
time, resolution time, severity targets, current time) with an **injectable clock** —
the mandatory six test scenarios above run instantly on synthetic timestamps with zero
waiting. Tests assert boundary behavior (exactly at the target = met, one second past
= breached).

**Why this priority**: correctness of the engine underpins every displayed status;
tests-first keeps it trustworthy.

**Independent Test**: run the six mandatory scenarios as unit tests against a pure
function with synthetic dates — no database, no sleeps.

**Acceptance Scenarios**:

1. **Given** the six mandatory scenarios implemented, **When** the suite runs,
   **Then** all pass using injected timestamps only (zero real waiting).
2. **Given** elapsed time exactly equal to the target, **When** evaluated, **Then**
   the SLA reads met (boundary is inclusive).
3. **Given** elapsed time one second beyond the target, **When** evaluated, **Then**
   the SLA reads breached.

---

### Edge Cases

- What happens when an admin shortens targets after events exist? → SLA status is
  **computed at read time with the current targets** (clarified): historical events
  may change met↔breached on display; nothing is frozen per event.
- Event acknowledged then resolved: both actuals are computed independently from the
  same report time.
- Event never acknowledged but resolved (admin override path): acknowledge SLA
  evaluates against now (likely breached); resolve SLA evaluates normally.
- Severity without configured targets → implementation defaults apply (targets are
  always total across the four severities).
- Sub-minute durations display rounded (e.g. "45s") but evaluation uses exact
  elapsed vs target in ms.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-201**: System MUST store SLA targets per severity: `ackMinutes` and
  `resolveMinutes`, Admin-configurable, readable by every signed-in role.
- **FR-202**: System MUST provide sensible defaults for all four severities without
  configuration (see Clarifications for the agreed values).
- **FR-203**: For every acknowledged event, the system MUST compute actual
  time-to-acknowledge = acknowledgement time − report time.
- **FR-204**: For every resolved event, the system MUST compute actual
  time-to-resolve = resolution time − report time.
- **FR-205**: Event API responses MUST include an SLA evaluation object per event
  containing, for both dimensions: target minutes, actual (elapsed minutes or live
  elapsed for open events), and status `MET` / `BREACHED` / `PENDING` (pending = not
  yet due and not yet done).
- **FR-206**: For open events, the acknowledgement dimension MUST read BREACHED once
  now > report + ackTarget without an acknowledgement, and the resolution dimension
  MUST read BREACHED once now > report + resolveTarget without a resolution —
  evaluated at read time with the current (injectable) time.
- **FR-207**: SLA evaluation MUST be computed at read time from current targets and
  current time — never stored per event — so status always reflects now.
- **FR-208**: The SLA evaluation MUST be a pure function with an injected clock
  parameter; unit tests MUST cover the six mandatory scenarios from the feature
  brief using synthetic timestamps with zero real waiting; the boundary at exactly
  the target counts as MET.
- **FR-209**: The event detail view MUST display both SLA dimensions (target, actual,
  met/breach indicator) and the events list MUST expose at least a compact SLA breach
  indicator.
- **FR-210**: Write access to targets MUST be restricted to Admins server-side; reads
  allowed for all authenticated roles.

### Key Entities *(include if feature involves data)*

- **SlaTarget**: severity (PK) → ackMinutes, resolveMinutes. Seeded defaults;
  Admin-editable. (Deliberately separate from spec/002's EscalationPolicy — clarified
  Q2: escalation windows route work; SLA targets measure performance.)
- *(reuses spec/001 fields)* ProductionEvent `createdAt` (report time),
  `acknowledgedAt`, `resolvedAt` — the only inputs needed for evaluation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-201**: All six mandatory mocked-time scenarios pass as unit tests (zero real
  waiting), plus boundary tests (exact target = met, +1 s = breached).
- **SC-202**: Every event detail response includes both SLA dimensions with target,
  actual and status; a breached-but-open event shows BREACHED without resolution.
- **SC-203**: Target updates by an Admin are visible to all roles on next read;
  non-admin writes are rejected 100% of the time.
- **SC-204**: Evaluation of an event is deterministic: same inputs + same now → same
  status (property checked by repeated evaluation in tests).

## Assumptions

- Measurement origin is the **report time** (`createdAt`), not assignment time
  (clarified Q3).
- Default targets (clarified Q1): CRITICAL ack 5 / resolve 60 · HIGH 15 / 240 ·
  MEDIUM 60 / 480 · LOW 240 / 1440 (minutes).
- SLA targets are stored separately from escalation windows (clarified Q2).
- Status is computed at read time with current targets (clarified Q4) — policy edits
  apply to all events' displayed status immediately.
- Durations in API payloads are minutes (fractional, one decimal); UI rounds for
  display.

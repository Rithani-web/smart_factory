# Feature Specification: Technician Rosters and Escalation Rules

**Feature Branch**: `002-technician-rosters-escalation`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Add a technician on-call roster per production/maintenance
team — an ordered list of Technicians who rotate on-call responsibility on a configurable
schedule (e.g. weekly), viewable by any authenticated user, editable by Admins only. Then
add production escalation policies: if a Production Event of a given severity is not
acknowledged within a configurable time window (e.g. Critical: 5 min, High: 15 min),
escalate to the next Technician in the on-call roster, then eventually to a designated
Admin/Production Manager if still unacknowledged. Escalation timing logic must be
unit-tested with injectable/mocked time, not real waiting. Log each escalation step on
the event's existing timeline/history. Same SDD workflow, same architecture and stack."

## Clarifications

### Session 2026-10-07

- Q: Should rotation teams replace or coexist with the spec/001 window-based duty
  roster as the assignment source? → A: Replace — rotation teams are the single source
  of truth; the spec/001 window table is migrated away; "no team configured → event
  stays OPEN and unassigned" behavior is preserved.
- Q: Which rotation cadences must be supported? → A: Exactly `WEEKLY` and `DAILY`,
  configurable per team, with a team-level anchor date-time.
- Q: What are the default escalation windows per severity? → A: CRITICAL 5 min,
  HIGH 15 min, MEDIUM 60 min, LOW never (no window).
- Q: What happens after escalation reaches the designated Admin? → A: Terminal — no
  further escalation; the designated Admin comes from team settings with fallback to
  the lowest-id ADMIN account.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Team rotation roster (Priority: P1)

An Admin defines maintenance teams, each with an **ordered** list of technicians and a
rotation schedule (cadence + anchor date). At any moment, exactly one technician per
team is "on duty" — determined by the rotation (e.g. weekly: position = whole weeks
since anchor, modulo list length). Every authenticated user can VIEW teams, rosters and
who is currently on duty; only Admins can create/edit them. Automatic assignment of new
events (spec/001) uses the current rotation instead of the spec/001 window entries.

**Why this priority**: escalation needs a deterministic "who is next" order, and
spec/001's assignment needs a roster source; this is the base both stand on.

**Independent Test**: with a 2-technician weekly rotation anchored this week, creating
an event assigns to position 0; changing the system date context (or anchor) to next
week assigns to position 1.

**Acceptance Scenarios**:

1. **Given** a team with technicians [A, B, C] on a weekly rotation anchored this week,
   **When** an event is created, **Then** it is assigned to A.
2. **Given** the same team, **When** the rotation window is the following week,
   **Then** the on-duty technician is B (rotation wraps after C back to A).
3. **Given** any signed-in role (incl. VIEWER), **When** viewing teams/rosters,
   **Then** the ordered technician list, cadence, anchor and current on-duty technician
   are visible.
4. **Given** a TECHNICIAN or VIEWER, **When** attempting to create or modify a team or
   its roster, **Then** the action is rejected server-side.
5. **Given** no team is configured at all, **When** an event is created, **Then** the
   event stays OPEN and unassigned (spec/001 FR-008 behavior preserved).

---

### User Story 2 - Escalation on unacknowledged events (Priority: P2)

An Admin configures escalation policies: per severity, how long an ASSIGNED event may
sit unacknowledged before escalating (defaults: Critical 5 min, High 15 min, Medium 60
min, Low never). A background evaluator checks ASSIGNED events whose acknowledgement
deadline has passed and **escalates**: reassign to the NEXT technician in the on-duty
team's rotation order; when the rotation is exhausted, escalate to a designated
Admin/Production Manager (terminal step). Every escalation step appends an
`ESCALATED` entry to the event's existing lifecycle history and notifies the new
assignee. Timing logic uses an **injectable clock** — tests simulate elapsed minutes
without waiting.

**Why this priority**: this is the spec's core value — no event silently rots with one
unresponsive technician — but it depends on US1's ordering.

**Independent Test**: with a 5-minute Critical policy, fabricate an event assigned 6
minutes ago (mocked clock), run one evaluator tick, and observe reassignment to the
next technician plus the history entry.

**Acceptance Scenarios**:

1. **Given** a Critical event ASSIGNED to A at T and policy Critical=5 min, **When**
   the evaluator runs at T+6 min and A has not acknowledged, **Then** the event is
   reassigned to B (next in order) and history gains `ESCALATED` (actor: system, detail
   naming A → B and the elapsed window).
2. **Given** the last technician in the rotation already had the event, **When** the
   deadline passes again unacknowledged, **Then** the event is escalated to the
   designated Admin (terminal; no further rotation) and history records it.
3. **Given** an event acknowledged before its deadline, **When** the evaluator runs,
   **Then** nothing changes.
4. **Given** a Low-severity event with no policy window, **When** the evaluator runs,
   **Then** nothing changes regardless of age.
5. **Given** a RESOLVED event, **When** the evaluator runs, **Then** nothing changes.

---

### User Story 3 - Policy management (Priority: P3)

Admins can view and edit escalation policies (per-severity minutes) and team rotation
settings. All authenticated users can view the effective policies. Changes take effect
for subsequent evaluator ticks without restarts.

**Why this priority**: configuration UX around the engine; the engine works with
seeded defaults first.

**Independent Test**: change the Critical window from 5 to 10 minutes as Admin, verify
a VIEWER sees the new value, and observe the evaluator honoring it on the next tick.

**Acceptance Scenarios**:

1. **Given** an Admin, **When** they set the Critical window to 10 minutes, **Then**
   the evaluator uses 10 minutes from the next tick onward.
2. **Given** any signed-in role, **When** requesting the policies, **Then** the
   effective per-severity windows are returned.
3. **Given** a TECHNICIAN or VIEWER, **When** attempting to modify policies, **Then**
   the action is rejected server-side.

---

### Edge Cases

- What happens when a team has only ONE technician? → Escalation from that technician
  goes straight to the designated Admin (rotation has no "next").
- What happens when a rotation position lands on the technician who is already
  assigned? → Skip to the following position (escalating to the same person is a no-op).
- What happens when a technician in the rotation was deactivated/removed? → They are
  skipped during rotation and escalation.
- Two escalation ticks fire close together? → Escalation steps are idempotent per
  deadline: one deadline transition produces exactly one history entry.
- What happens to an already-escalated event when a NEW escalation policy shortens
  windows? → Existing deadlines keep their originally computed time; only new
  assignments use the new policy.
- What happens when multiple teams exist? → The first team (by creation order) is the
  escalation/assignment source in this spec; multi-team routing is out of scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-101**: System MUST let Admins create and edit maintenance teams, each with a
  name and an ordered list of technician members.
- **FR-102**: System MUST let Admins configure each team's rotation: a cadence of
  exactly one of `WEEKLY` or `DAILY`, plus an anchor date-time that starts position 0.
- **FR-103**: System MUST compute the current on-duty technician per team
  deterministically from cadence + anchor + ordered membership (wrapping around).
- **FR-104**: System MUST expose teams, ordered rosters and the current on-duty
  technician to every authenticated role, and MUST restrict all create/edit operations
  to Admins (server-enforced).
- **FR-105**: Automatic assignment of new production events (spec/001 FR-007) MUST use
  the current rotation of the first team; if no team or member exists, the event stays
  OPEN and unassigned (FR-008 semantics preserved).
- **FR-106**: System MUST store escalation policies as minutes-per-severity; seeded
  defaults: CRITICAL 5, HIGH 15, MEDIUM 60, LOW never (no window).
- **FR-107**: For every ASSIGNED event whose severity has a policy window, the system
  MUST compute an acknowledgement deadline = assignment time + window.
- **FR-108**: The system MUST run an evaluator (in-process, injectable clock) that
  escalates ASSIGNED events past their deadline to the next technician in the on-duty
  team's rotation order, skipping the current assignee and inactive members, wrapping
  the rotation.
- **FR-109**: When the rotation is exhausted (the escaldee was the last eligible
  member), the system MUST escalate to the designated Admin/Production Manager account
  (a configured ADMIN user) as the terminal step.
- **FR-110**: Every escalation MUST append an `ESCALATED` entry to the event's existing
  lifecycle history (actor: system, detail: from → to + reason window) and MUST send a
  notification to the new assignee (recorded per spec/001 FR-010).
- **FR-111**: Escalation steps MUST be idempotent per deadline: at most one escalation
  per computed deadline transition, even if the evaluator runs repeatedly.
- **FR-112**: Acknowledging an event MUST stop further escalation of the current
  deadline; a NEW deadline starts only if the event is reassigned again.
- **FR-113**: Escalation timing logic MUST be testable with an injected clock — no test
  may rely on real elapsed time or sleeps.
- **FR-114**: Admins MUST be able to edit escalation windows; edits apply to deadlines
  computed after the change; any signed-in role can read the effective policies.

### Key Entities *(include if feature involves data)*

- **Team**: name, rotation cadence (`WEEKLY`/`DAILY`), anchor date-time, designated
  escalation Admin (optional → falls back to any ADMIN), creation-ordered.
- **TeamMembership**: ordered position (0-based) linking a Team to a Technician;
  positions are dense and reorderable by Admins.
- **EscalationPolicy**: severity → window minutes (nullable = never escalates).
- **EscalationState** (per event): current rotation offset + the active deadline —
  makes FR-111 idempotency explicit (a deadline escalates at most once).
- *(extends spec/001)* **Assignment / HistoryEntry**: escalations are reassignments
  (`active` flag swap) plus `ESCALATED` history entries.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-101**: A Critical event that is never acknowledged is escalated within one
  evaluator tick after its 5-minute deadline (verified with mocked time, zero real
  waits in the test suite).
- **SC-102**: Rotation math is correct for at least 3 full wrap-around cycles
  (position = weeks mod length) — proven by unit tests.
- **SC-103**: 100% of escalation steps appear in the affected event's history with
  actor `SYSTEM`, from → to detail, and a recorded notification attempt.
- **SC-104**: Zero escalations occur for acknowledged, resolved, or no-policy events
  (SC/FR-111/112 negative tests all green).
- **SC-105**: A VIEWER can see rosters, on-duty status and policies; a non-admin
  write attempt is rejected 100% of the time.

## Assumptions

- The spec/001 window-based `DutyRosterEntry` is superseded by rotation teams;
  assignment switches to the rotation. (Clarification gate will confirm replace vs
  coexist before planning.)
- One escalation evaluator runs inside the backend process on a short interval
  (e.g. every 30 s); no external scheduler/queue is introduced (Constitution VI).
- The "designated Admin/Production Manager" is an ADMIN user chosen in team settings,
  falling back to the lowest-id ADMIN when unset.
- Escalation notifications reuse the existing email path; without a Resend key they
  are recorded as FAILED (spec/001 FR-010 semantics).
- Rotation math uses UTC; a `DAILY` cadence advances position once per 24 h from the
  anchor.

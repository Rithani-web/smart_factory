# Feature Specification: Dashboard, Public Status Page & Hardening Release

**Feature Branch**: `004-advanced-execution-verification`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "One cohesive release: (1) Dashboard & Reporting — open
events by severity, on-call technician per team, SLA compliance rate over a selectable
period, event volume trend chart; filterable by team and time period; Admins see all
teams, other roles default to their team(s) with read-only access to others (Recharts).
(2) Public Factory Status Page — unauthenticated, per-team derived status (Operational /
Degraded / Partial Outage / Major Outage) from open events' highest severity, with
Admin manual status messages clearly distinguished. (3) Hardening — comprehensive unit
coverage for the event state machine, escalation timing, SLA calculation (mocked time,
no real waiting); realistic seed/demo data incl. an SLA-breached event; RBAC edge-case
tests; loading/empty/error/skeleton states on every touched view. Professional,
polished SaaS look — deliberate palette, spacing, typography, hierarchy; proper
dashboard layout with sidebar/top navigation; Statuspage-quality public page; responsive
desktop+tablet. Existing screens brought in line as tech debt. Same architecture, SDD
methodology, Spec Kit workflow, stack (plus Recharts per this brief), auth/RBAC, Neon,
Resend, and all existing models."

## Clarifications

### Session 2026-10-07

- Q: How does an open-event set map to a team's derived status? → A: no open events =
  `OPERATIONAL`; any LOW/MEDIUM open = `DEGRADED`; any HIGH open = `PARTIAL_OUTAGE`;
  any CRITICAL open = `MAJOR_OUTAGE` (highest severity wins).
- Q: How is SLA compliance rate defined? → A: of events created within the selected
  period, the share whose acknowledge AND resolve SLAs (evaluated at read time) are
  MET — reported as met/total/rate; pending events count against neither until due
  (excluded from the denominator while any dimension is PENDING).
- Q: Recharts and the unauthenticated page vs the fixed-stack constitution? → A:
  constitution amended to v1.3.0 sanctioning Recharts and the scoped public surface.
- Q: What does "default to their own team(s)" mean for non-Admins? → A: the dashboard
  filter defaults to the teams a user is a member of (fallback: all teams); switching
  to other teams is permitted read-only — consistent with existing read RBAC.
- Q: Shape of the manual status override? → A: at most one active message per team,
  set/cleared by Admins, stored with author + timestamp; the public page renders it
  with a visible "Manual override" marker, visually distinct from derived status.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operations dashboard (Priority: P1)

A plant user opens the dashboard and sees: open events grouped by severity (four
counters), the current on-call technician per team, the SLA compliance rate for a
selected period, and an event-volume trend chart. Filters: team and time period
(e.g. 7/30/90 days). Admins see all teams; Technicians/Viewers default to their own
team(s) and may view others read-only (existing RBAC already grants read).

**Why this priority**: the dashboard is the operator's cockpit — the release's
headline value.

**Independent Test**: seed known data; request the summary for a period; verify
severity counts, on-duty names, compliance rate and volume buckets against the seed.

**Acceptance Scenarios**:

1. **Given** seeded open events across severities, **When** the dashboard loads
   (all-teams filter), **Then** the four severity counters equal the seed counts.
2. **Given** a weekly rotation team, **When** the dashboard renders, **Then** the
   on-call panel shows the rotation-computed on-duty technician per team.
3. **Given** a period with 10 due events of which 8 met both SLAs, **When** the
   compliance stat renders, **Then** it shows 80% (8/10).
4. **Given** a Technician (non-admin), **When** the dashboard loads, **Then** the
   team filter defaults to their membership and data is view-only regardless of
   filter.
5. **Given** filters changed (team=Line A, period=7d), **When** data refetches,
   **Then** all panels reflect the filtered query.

---

### User Story 2 - Public factory status page (Priority: P1)

Anyone with the URL — no login — sees the operational status of every team: a derived
status per team (from open events: none=Operational, LOW/MEDIUM=Degraded, HIGH=Partial
Outage, CRITICAL=Major Outage) with the highest severity winning; Admins can post one
manual status message per team (e.g. planned maintenance) which **overrides** the
derived status and is **clearly marked** as a manual override. The page reads like a
production status page: overall banner, per-team rows with status color/label, manual
messages, last-updated information. No personal data (no names/emails) on this page.

**Why this priority**: the externally visible face of the factory; explicitly
highlighted in the brief.

**Independent Test**: with a CRITICAL open event on Team A and a manual "planned
maintenance" message on Team B, the public endpoint returns Major Outage (derived) for
A and the override for B, without any authentication.

**Acceptance Scenarios**:

1. **Given** Team A has an open CRITICAL event, **When** the public status is fetched
   unauthenticated, **Then** Team A shows MAJOR_OUTAGE (derived marker, no manual
   message).
2. **Given** Team B has only a LOW open event, **When** fetched, **Then** Team B shows
   DEGRADED.
3. **Given** an Admin posts "Planned maintenance scheduled for Production Line A" on
   Team C, **When** fetched, **Then** Team C shows the manual status distinctly
   labeled as a manual override.
4. **Given** an Admin clears the override, **When** fetched, **Then** Team C reverts
   to its derived status.
5. **Given** no authentication at all, **When** the page/API is requested, **Then**
   it responds 200 — and contains no emails or assignee identities.

---

### User Story 3 - Hardening: tests, seed & states (Priority: P2)

Comprehensive unit coverage lands for the event state machine (every legal and
illegal transition per role), escalation timing (mocked clock), and SLA calculation
(mocked clock) — zero real waiting anywhere. Realistic demo seed: multiple teams with
rosters, users in all roles, events across Open/Acknowledged/Resolved and all four
severities, and at least one currently SLA-breached open event. RBAC edge cases get
dedicated tests. Every frontend view touched by this release handles loading
(skeletons), empty and error states consistently.

**Why this priority**: it hardens everything shipped so far; high value, but the two
P1 stories define what it hardens.

**Independent Test**: run the full suite — state-machine matrix, escalation and SLA
suites all green on synthetic time; seed script produces the documented demo dataset;
UI renders skeleton→content deterministically.

**Acceptance Scenarios**:

1. **Given** the state-machine suite, **When** run, **Then** every (status, action,
   actor-role) combination is asserted legal or rejected per the spec/001 transition
   table.
2. **Given** the seed script, **When** run against a clean database, **Then** the
   documented demo dataset exists (teams, users, rosters, events in all states,
   ≥1 SLA-breached open event).
3. **Given** any touched view with the API down, **When** rendered, **Then** an error
   state shows (no blank screen); while loading, skeletons show.

---

## Edge Cases

- Empty database (fresh install): dashboard shows zeroed counters, "no data" chart
  state, 0/0 compliance rendered as "—"; status page shows all teams Operational.
- Override on a team with no events: manual status still displays (override wins over
  Operational).
- Volume buckets at period edges: buckets are UTC days; events exactly at midnight
  belong to the later day.
- Non-member Technician filters to another team: allowed, read-only (no write exists
  on dashboard anyway).
- Two CRITICAL events on one team: still one MAJOR_OUTAGE (status is derived from the
  set, not counted).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-301**: The system MUST expose an operations dashboard summary (open counts per
  severity, per-team on-duty technician, SLA compliance rate, event volume trend)
  filterable by team and period, computed from existing data at request time.
- **FR-302**: Dashboard reads MUST be available to every authenticated role; Admins
  default to all teams, non-Admins default to their own team membership; all views are
  read-only.
- **FR-303**: The system MUST expose a public, unauthenticated status endpoint
  returning per-team: derived status, active manual override (message, author name,
  timestamp) and open-event severity counts — with no personal data (FR-018 holds).
- **FR-304**: Derived status MUST follow the clarified mapping (none→OPERATIONAL,
  LOW/MEDIUM→DEGRADED, HIGH→PARTIAL_OUTAGE, CRITICAL→MAJOR_OUTAGE; highest severity
  wins).
- **FR-305**: Admins MUST be able to set and clear one manual status message per team;
  the manual override MUST be distinguishable from derived status in every surface
  that shows it.
- **FR-306**: Charts MUST use Recharts with the application's visual identity,
  legends, readable axes and graceful empty-data handling.
- **FR-307**: The public status page MUST present an overall banner, per-team status
  rows (color + label + open counts), manual overrides marked "Manual override", and
  last-updated information — usable unauthenticated, responsive at desktop and tablet.
- **FR-308**: The dashboard MUST present a proper application layout (sidebar/top
  navigation, cards/panels with clear hierarchy) consistent with a deliberate design
  system: defined palette, spacing scale, typography; no default/unstyled appearance.
- **FR-309**: Unit tests MUST cover: the full event state-machine transition matrix,
  escalation timing (mocked clock), SLA calculation (mocked clock) — no real waiting.
- **FR-310**: The seed script MUST produce the documented demo dataset (≥2 teams with
  rosters, users in all roles, events in Open/Acknowledged/Resolved across all
  severities, ≥1 currently SLA-breached open event).
- **FR-311**: Dedicated RBAC edge-case tests MUST cover: unauthenticated access to
  protected routes, pending-password gate on new endpoints, non-admin writes to
  status messages, and public-surface data minimality.
- **FR-312**: Every view touched by this release MUST implement loading (skeleton),
  empty and error states; existing screens touched by the design-system work MUST be
  brought up to the same standard (tech debt retired in this release).

### Key Entities *(include if feature involves data)*

- **StatusMessage**: team (unique active) → message, author, timestamp; cleared by
  Admins. The only new table.
- *(computed, not stored)* Derived team status; SLA compliance; volume buckets — all
  derived at request time from existing tables (Constitution IV spirit).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-301**: Dashboard panels match seeded expectations exactly (counts, on-duty,
  80%-style compliance, bucket sums = event total) in contract tests.
- **SC-302**: Public status endpoint answers 200 unauthenticated and leaks zero
  emails/assignee names (asserted by scanning the payload).
- **SC-303**: State-machine suite asserts every cell of the transition×role matrix;
  escalation + SLA suites remain green on synthetic time only.
- **SC-304**: Seed yields the documented dataset on a clean DB, including ≥1 open
  SLA-breached CRITICAL event.
- **SC-305**: Every touched view has visible loading/empty/error states (component
  tests or deterministic render assertions).

## Assumptions

- Volume chart buckets by UTC day; supported periods: 7/30/90 days.
- SLA compliance counts events CREATED in the period; evaluation at read time.
- The public page shows team display names only — on-call identities stay behind
  authentication (dashboard).
- Design system: Tailwind-based tokens (palette/spacing/typography) defined once in
  the frontend; no CSS framework additions.
- Recharts is the only new dependency (constitution v1.3.0).

# Research: Dashboard, Public Status Page & Hardening (spec/004)

## D21. Status derivation as a pure function

- **Decision**: `deriveTeamStatus(openSeverities: Severity[]) →
  OPERATIONAL|DEGRADED|PARTIAL_OUTAGE|MAJOR_OUTAGE` — max severity maps none→
  OPERATIONAL, LOW/MEDIUM→DEGRADED, HIGH→PARTIAL_OUTAGE, CRITICAL→MAJOR_OUTAGE.
  Final displayed status = active manual override ?? derived.
- **Rationale**: clarified mapping; pure unit-testable core behind both the public
  endpoint and the admin override UI.

## D22. Dashboard aggregation in one endpoint

- **Decision**: `GET /api/dashboard/summary?teamId&days` runs four aggregate queries
  in parallel (open counts grouped by severity, teams+rotation on-duty, SLA
  compliance over events created in the window, volume bucketed by UTC day) and
  returns one typed payload. Compliance excludes events with any PENDING dimension
  from the denominator (clarified Q2).
- **Rationale**: single round-trip for the cockpit; filters applied SQL-side; the UI
  refetches on filter change.

## D23. Public surface data minimality

- **Decision**: `/api/public/status` is mounted BEFORE auth middleware, returns team
  display names, derived/final status, open counts, active override message + author
  **display name** + timestamp, and a server timestamp. A test asserts the payload
  contains no '@' emails and no assignee identities (FR-311, constitution v1.3.0).
- **Rationale**: the one sanctioned unauthenticated surface; minimality by contract
  test, not by convention.

## D24. State-machine hardening via exhaustive matrix

- **Decision**: a dedicated suite enumerates every (current status × action × actor
  role) cell against the spec/001 transition table through the service layer — legal
  cells assert success + history entry, illegal cells assert the exact 403/409 code.
- **Rationale**: FR-309's "comprehensive" is verifiable only as a matrix; existing
  suites cover happy paths, this closes the gaps (e.g., TECHNICIAN resolve-from-OPEN
  after reassignment, ADMIN acknowledge of RESOLVED, etc.).

## D25. Design system tokens

- **Decision**: one `theme.css` defines CSS custom properties (palette: slate
  neutrals + industrial blue primary + four status colors; spacing scale; type scale)
  consumed via Tailwind arbitrary values; shared primitives (Card, Panel header,
  Skeleton, EmptyState, ErrorState, StatusDot) built once and reused everywhere —
  including retrofitting EventsList/EventDetail/Login/Teams (declared tech debt).
- **Rationale**: FR-308/312 demand a deliberate identity and consistent states;
  tokens+primitives are the cheapest honest way without new frameworks.

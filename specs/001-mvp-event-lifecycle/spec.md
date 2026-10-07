# Feature Specification: MVP Production Event Lifecycle

**Feature Branch**: `001-mvp-event-lifecycle`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "spec/001 — MVP Production Event Lifecycle. The MVP core of the
Smart Factory Production Automation System: report a production/machine event, automatically
assign an on-duty technician, notify them, and walk the event through acknowledgement and
resolution with a complete lifecycle trail — with authenticated, role-based access."

## Clarifications

### Session 2026-10-07

- Q: Does this system serve one single factory organization, or must it support multiple
  isolated organizations sharing one installation? → A: Single shared organization — one
  deployment serves one factory; no organization boundary exists in the data model, and
  multi-tenancy is out of scope for every spec in this exercise.
- Q: Can an Admin move an event to a different technician after it has already been
  assigned or acknowledged? → A: Yes — Admin can reassign any active event (Open,
  Assigned, or Acknowledged) to another technician; each reassignment is recorded in the
  lifecycle history.
- Q: Should Viewers see the assigned technician's full contact details including email?
  → A: Personal details stay minimal — event views show only a person's name and role;
  email addresses are never displayed in any view (they exist only for sign-in and
  notification delivery).
- Q: Must a technician acknowledge an event before they are allowed to resolve it?
  → A: Yes — a technician MUST acknowledge an event before resolving it (resolve only
  from Acknowledged status); an Admin MAY resolve from any active status.
- Q: When an Admin creates a new user account, how does that person get their password?
  → A: The Admin sets a temporary password; the user MUST choose their own new password
  at first sign-in before performing any other action.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Authenticated, role-gated access (Priority: P1)

Every actor — production supervisor, technician, plant admin, viewer — must identify
themselves before touching any production event, and the system must enforce what each
role may do. Admins can do everything; Technicians (Production Responders) work events;
Viewers observe only.

**Why this priority**: nothing else in the lifecycle is meaningful or safe without
identity and roles; every later story assumes it.

**Independent Test**: Can be fully tested by attempting each protected action as each
role (signed in and not signed in) and verifying allowed/rejected outcomes.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** they attempt any production-event
   operation (view, create, acknowledge, resolve), **Then** access is denied and they are
   prompted to sign in.
2. **Given** a user signed in with correct email and password, **When** they sign in,
   **Then** they remain signed in across subsequent actions without re-entering
   credentials, and can sign out.
3. **Given** a Viewer signed in, **When** they attempt to create, acknowledge, or resolve
   an event, **Then** the action is rejected server-side and nothing changes.
4. **Given** an Admin signed in, **When** they perform any lifecycle action on an event,
   **Then** the action is permitted.
5. **Given** a new account still on its Admin-set temporary password, **When** the user
   signs in, **Then** they must set their own new password before any other action.

---

### User Story 2 - Report a production event (Priority: P1)

A production supervisor or technician notices a machine problem (e.g., "Packaging line 2
jammer fault") and reports it: a short title, a description, the affected machine/line,
and the production impact/severity. The system records the event in status **Open** with
who reported it and when.

**Why this priority**: the event registry is the core value of the MVP; without created
events there is nothing to assign, notify, or resolve.

**Independent Test**: Can be fully tested by creating an event and verifying it appears
with all entered details, status Open, reporter, and timestamp.

**Acceptance Scenarios**:

1. **Given** a Technician or Admin signed in, **When** they submit a new event with title,
   description, severity, and machine/line reference, **Then** the event is created with
   status Open, the reporter and creation time recorded.
2. **Given** any signed-in user, **When** they submit an event missing a required field
   (title, severity, machine/line), **Then** creation is rejected with a clear message
   naming the missing field.
3. **Given** a submitted severity, **When** it is not one of Low / Medium / High /
   Critical, **Then** creation is rejected.

---

### User Story 3 - Automatic assignment and notification (Priority: P1)

The moment an event is created, the system consults the maintenance roster (who is on
duty now), assigns the event to an available on-duty technician, and sends them an email
notification containing the event details. Status becomes **Assigned** once a technician
is assigned.

**Why this priority**: routing work to the right person automatically is the system's
reason to exist beyond a paper log.

**Independent Test**: Can be fully tested by creating an event while a known technician
is on duty and verifying assignment to that technician and dispatch of a notification
email describing the event.

**Acceptance Scenarios**:

1. **Given** at least one technician is on duty per the roster, **When** a new event is
   created, **Then** the event is assigned to an on-duty technician, status becomes
   Assigned, and a notification email with the event title, severity, machine/line, and
   description is sent to that technician.
2. **Given** no technician is on duty per the roster, **When** a new event is created,
   **Then** the event stays in status Open, is visibly marked unassigned, and the creator
   is informed that no on-duty technician was available.
3. **Given** an event already Assigned, **When** it is viewed, **Then** the assigned
   technician's name and assignment time are shown.

---

### User Story 4 - Technician acknowledgement (Priority: P2)

The assigned technician sees the notification, opens the event, and acknowledges it —
declaring "I am on it." Status becomes **Acknowledged** with the acknowledgement time
recorded.

**Why this priority**: acknowledgement closes the "was the alert actually picked up?" gap
before resolution can be trusted; it depends on assignment existing first.

**Independent Test**: Can be fully tested by acknowledging an assigned event as the
assigned technician and verifying status and timestamp; and by attempting the same as a
different technician and verifying rejection.

**Acceptance Scenarios**:

1. **Given** an event Assigned to technician T, **When** T acknowledges it, **Then**
   status becomes Acknowledged and the acknowledgement time and actor are recorded.
2. **Given** an event Assigned to technician T, **When** a different technician attempts
   to acknowledge it, **Then** the action is rejected server-side.
3. **Given** an event in status Open (unassigned), **When** anyone attempts to
   acknowledge it, **Then** the action is rejected.

---

### User Story 5 - Resolution (Priority: P2)

The assigned technician fixes the issue (e.g., clears the jam) and resolves the event
with mandatory resolution notes describing what was done. An Admin may also resolve any
event on a technician's behalf. Status becomes **Resolved**.

**Why this priority**: resolution completes the lifecycle and captures the knowledge of
what fixed the problem; it is the natural end state of every event.

**Independent Test**: Can be fully tested by resolving an event with notes and verifying
status, notes, resolver, and timestamp; and by attempting resolution without notes and
verifying rejection.

**Acceptance Scenarios**:

1. **Given** an event Acknowledged by technician T, **When** T resolves it with
   resolution notes, **Then** status becomes Resolved with notes, resolver, and time
   recorded.
2. **Given** an event in any active status, **When** an Admin resolves it with notes,
   **Then** it becomes Resolved.
3. **Given** a resolution attempt without resolution notes, **When** submitted, **Then**
   the action is rejected with a message that notes are required.
4. **Given** an event in Assigned status (not yet acknowledged), **When** the assigned
   technician attempts to resolve it, **Then** the action is rejected with a message
   that the event must be acknowledged first.

---

### User Story 6 - Lifecycle history (Priority: P3)

For every event, the system retains and displays the complete trail: creation, assignment,
acknowledgement, resolution — each with timestamp and actor — so anyone can reconstruct
what happened and when.

**Why this priority**: history is essential for the course's verification/convergence
discipline and for audits, but the lifecycle already works without it being rich.

**Independent Test**: Can be fully tested by walking an event through its lifecycle and
verifying the history view lists every transition in order with actor and timestamp.

**Acceptance Scenarios**:

1. **Given** an event that went through create → assign → acknowledge → resolve, **When**
   its history is viewed, **Then** all four transitions appear in chronological order
   with actor and timestamp.
2. **Given** any signed-in role including Viewer, **When** they open an event, **Then**
   the history is visible.

---

### Edge Cases

- What happens when two events are created simultaneously and only one technician is on
  duty? → Each event is assigned; the technician may hold multiple assigned events (no
  capacity model in MVP).
- What happens when the assigned technician is no longer on duty at acknowledge time? →
  The assignment stands for the lifecycle of the event; roster changes do not retroactively
  reassign open events (reassignment rules are spec/002 territory).
- How does the system handle resolving an event that was never acknowledged? → An Admin
  may resolve it, and the history shows the skipped acknowledgement honestly rather than
  fabricating one; a technician may NOT — their resolve attempt is rejected until they
  acknowledge the event (FR-012).
- What happens when an email cannot be delivered? → Assignment remains valid; the system
  records the notification attempt and its failure; delivery failure does not silently
  mark an event notified.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST require every user to authenticate before performing or viewing
  any production-event operation.
- **FR-002**: System MUST support exactly three roles — Admin, Technician (Production
  Responder), Viewer — and MUST enforce permissions on the server for every operation.
- **FR-003**: System MUST let signed-in users remain authenticated across actions and
  sign out explicitly.
- **FR-004**: System MUST let Admins and Technicians create a production event with: a
  short title, a description, a machine/line reference, and a severity.
- **FR-005**: System MUST restrict severity to exactly: Low, Medium, High, Critical.
- **FR-006**: System MUST record for every event: reporter, creation time, and current
  status; every event MUST be in exactly one of: Open, Assigned, Acknowledged, Resolved.
- **FR-007**: System MUST automatically assign a newly created event to an available
  on-duty technician as determined by the current maintenance roster, at creation time.
- **FR-008**: When no technician is on duty per the roster, System MUST leave the event
  Open, mark it unassigned, and inform the creator.
- **FR-009**: System MUST send an email notification to the assigned technician when an
  event is assigned, containing title, severity, machine/line reference, and description.
- **FR-010**: System MUST record every notification attempt (recipient, time, outcome)
  against the event.
- **FR-011**: System MUST allow only the assigned technician — or an Admin — to
  acknowledge an event, and only while it is in Assigned status.
- **FR-012**: System MUST allow only the assigned technician — or an Admin — to resolve
  an event. A technician MUST have acknowledged the event first (technician resolve is
  possible only from Acknowledged status); an Admin MAY resolve from any active status.
- **FR-013**: System MUST require non-empty resolution notes to resolve an event.
- **FR-014**: System MUST retain a complete, chronological lifecycle history per event:
  every status transition with timestamp and actor.
- **FR-015**: System MUST let every signed-in role, including Viewer, view the event list
  with status and severity, and each event's detail including history.
- **FR-016**: System MUST reject with a clear message any action attempted by a role that
  is not permitted to perform it, without changing any state.
- **FR-017**: System MUST allow an Admin to reassign an active event (Open, Assigned, or
  Acknowledged) to another technician, replacing the active assignment and recording the
  reassignment in the lifecycle history.
- **FR-018**: Event views MUST keep personal details minimal: only a person's name and
  role are shown; email addresses MUST NOT appear in any view for any role.
- **FR-019**: Accounts created by an Admin MUST start with a temporary password, and the
  user MUST set their own new password at first sign-in before any other action is
  possible.

### Key Entities *(include if feature involves data)*

- **Production Event**: the central record — title, description, severity
  (Low/Medium/High/Critical), machine/line reference, status (Open → Assigned →
  Acknowledged → Resolved), reporter, created/acknowledged/resolved timestamps.
- **User**: an account with role (Admin, Technician, Viewer), name, email. Email is
  internal-only — sign-in and notification delivery — and is never displayed (FR-018).
  Technicians are the assignable responders.
- **Assignment**: links an event to the technician responsible for it, with assignment
  time; one active assignment per event in MVP — an Admin reassignment (FR-017) replaces
  the active assignment, and the prior one survives in history.
- **Duty Roster Entry**: declares which technician is on duty at a given time (minimal in
  this feature — enough to answer "who is on duty now"; full roster/escalation rules come
  in spec/002).
- **Notification**: an outbound notification tied to an event and recipient, with
  timestamp and delivery outcome.
- **Lifecycle History Entry**: one recorded transition (from-status, to-status, actor,
  timestamp) in the event's trail.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A supervisor can report a machine issue and see it recorded with status
  Open in under 2 minutes from sign-in.
- **SC-002**: When an on-duty technician exists, every new event is Assigned (not Open)
  within 1 minute of creation.
- **SC-003**: The assigned technician receives the notification email within 5 minutes
  of assignment under normal operation.
- **SC-004**: An event can be walked through create → assign → acknowledge → resolve and
  every transition appears in its history with correct actor and timestamp, verified for
  100% of transitions.
- **SC-005**: 100% of unauthorized action attempts (wrong role, unauthenticated) are
  rejected with no state change.
- **SC-006**: Events lacking an on-duty technician are identifiable as unassigned within
  the event list at a glance.
- **SC-007**: A technician can go from notification email to acknowledged event in under
  30 seconds.

## Assumptions

- The system serves a single factory organization (clarified 2026-10-07): no organization
  entity, field, or filter exists anywhere in the model.
- Authentication is email + password; users stay signed in across actions through the
  project's secure token-based session mechanism (defined by the project brief and
  constitution, not by this specification).
- User accounts are provisioned by an Admin (no public self-registration in the MVP).
- All escalation behavior — no-response timers, escalation tiers, roster rules beyond
  "who is on duty now" — is OUT of scope here and belongs to spec/002 (Technician Rosters
  and Escalation Rules).
- Machine/line is a free-text reference in the MVP; no machine master-data registry is
  modeled (that would be new scope beyond the original exercise).
- Email is delivered through the project's transactional email service; the spec only
  requires that a notification is attempted and its outcome recorded.
- The MVP assignment rule is deliberately simple — first available on-duty technician —
  because the original course assigns roster/escalation sophistication to spec/002.

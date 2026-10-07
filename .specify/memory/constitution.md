<!--
Sync Impact Report
- Version change: 1.2.0 → 1.3.0
- Modified principles: VI. Course Fidelity & Simplicity — Fixed Technology Stack
  section extended by explicit user directive (spec/004 brief, 2026-10-07):
  + Recharts for dashboard charts (frontend)
  + Public Factory Status Page: a scoped UNAUTHENTICATED read-only surface
    (page + /api/public/* aggregate endpoint) — the only exempted route class;
    it exposes team names and derived/manual status only, never personal data
    (FR-018 email rule still applies everywhere)
- Added sections: none
- Removed sections: none
- Reason for MINOR bump: materially expanded sanctioned stack per authoritative
  project brief; no principle weakened — server-side authorization unchanged for
  every authenticated surface
-->

# Smart Factory Production Automation System Constitution

## Core Principles

### I. Spec-Driven Development

Specifications are the source of truth for what the system MUST do. No implementation
begins without an approved specification, and every specification claim MUST be stated
as a testable contract (given input → expected outcome). Work proceeds only through the
Spec Kit lifecycle: specify → clarify → plan → tasks → implement → verify. Rationale:
specifications, not ad-hoc prompts, drive AI-assisted engineering; prompting alone
produces the "illusion of completeness".

### II. Mandatory Server-Side Authorization

Every permission check MUST be enforced on the server for every operation. Role checks
in the client interface are presentation only and MUST NOT be trusted as access control.
Any operation reachable without the required role is a defect regardless of what the
UI shows. Rationale: the client is an untrusted boundary; authorization lives where the
data lives.

### III. End-to-End TypeScript Types

TypeScript MUST be used everywhere, and types MUST flow end-to-end: the same type
definitions MUST describe a data contract at the schema boundary, on the server, and in
the client. Duplicated or hand-maintained divergent shapes for the same contract are a
defect. When a contract changes, one change MUST propagate to both sides. Rationale:
type drift between backend and frontend is the primary source of silent contract
violations in a TypeScript codebase.

### IV. Single Source of Truth for Schema

The database schema MUST be defined in exactly one place, and everything else —
migrations, server types, client types — MUST derive from it. Hand-written parallel
structures that restate the schema (second copies of models, duplicated field lists)
MUST NOT exist. A schema change is made once, in the source of truth, and propagated.
Rationale: any second copy of the schema will eventually disagree with the first, and
the disagreement surfaces as runtime defects.

### V. Secure Authentication by Default

Authentication and secure session handling MUST be built in from the first runnable
increment, never bolted on later. Passwords MUST be stored only as salted hashes.
Session tokens MUST be delivered so that client scripts cannot read them (HTTP-only
cookies) and MUST expire; renewal MUST use refresh tokens. Secrets (database URLs,
token-signing keys, email API keys) MUST live only in `.env` and MUST never be
committed. Rationale: retrofitting authentication is the most expensive defect class;
the course project treats security as a default, not a feature.

### VI. Course Fidelity & Simplicity

This project is the course's incident-management exercise with the domain substituted
to Smart Factory Production Automation. Architecture, complexity, spec structure
(spec/001–004), and workflow MUST mirror the original course exercise (see
`docs/ORIGINAL-BASELINE.md`, `docs/DOMAIN-MAPPING.md`). Where manufacturing realism
conflicts with course fidelity, course fidelity wins. No technology MAY be added beyond
the fixed stack: no IoT, ML, predictive maintenance, microservices, or event streaming.
Rationale: the purpose is learning the course's SDD method exactly; additions dilute
the exercise.

## Fixed Technology Stack & Domain Fidelity

Authoritative per the project brief (2026-10-07). TypeScript everywhere; no alternative
frameworks, databases, auth systems, messaging systems, or infrastructure unless the
original project specifications explicitly require them.

- Backend: Node.js + Express + Prisma, TypeScript, located at `/backend`.
- Frontend: React + Vite + Tailwind CSS, TypeScript, located at `/frontend`.
- Database: PostgreSQL hosted on Neon, accessed through Prisma; connection via
  `DATABASE_URL` from `.env` (matches the original course project). Never commit `.env`.
- Authentication: JWT — access token + refresh token, HTTP-only cookies, role-based
  access control enforced **server-side**. Roles: Admin, Technician (Production
  Responder), Viewer (domain mapping of the original Admin/Responder/Viewer).
- Email/notifications: Resend, worded as production/maintenance alerts.
- Charts: **Recharts** on the frontend (added by user directive in the spec/004
  brief — the sole sanctioned charting library).
- Public Status Page: one unauthenticated read-only surface (the `/status` route and
  its `/api/public/*` data endpoint), scoped to team names and derived/manual
  operational status — never personal data (no emails, no assignee identities).
  Every other surface remains behind authentication.
- Testing: contract tests assert observable API behavior against the specs; runner
  fixed as **Vitest** (spec/001 plan, D1).

## Development Workflow & Quality Gates

- Lifecycle per feature: `specify` → `clarify` (gate) → `plan` → `roadmap/tasks` →
  `implement` → `verify`/`converge`, run in that order without skipping gates.
- **Clarification gate**: ambiguity MUST be resolved through `clarify` before planning;
  AI MUST NOT guess at material ambiguity, and implementation MUST NOT start while one
  remains open.
- **Verification & convergence**: an implementation is DONE only when verified against
  the spec's contracts; implement → verify repeats until checks report convergence.
  Missing verification is not a successful implementation.
- Constitution check: `plan` MUST verify compliance with this constitution before tasks
  are generated.
- Quality gates: (1) spec has no unresolved material ambiguities; (2) every acceptance
  criterion is a runnable contract test; (3) verification reports convergence before a
  spec is closed; (4) each spec maps 1:1 to the original course spec's intent.
- Progressive levels of SDD (spec-guided → structured/automated → spec-as-source) are
  practiced within the course's spec/003–004 scope only.

## Governance

- This constitution supersedes all other development practices in this repository.
- Amendments MUST be documented in this file with a version bump (semantic versioning:
  MAJOR = principle removal/redefinition, MINOR = new principle/material expansion,
  PATCH = clarifications) and a Sync Impact Report at the top of the file.
- All plans, tasks, and reviews MUST verify compliance with these principles; complexity
  beyond the fixed stack requires a constitution amendment first.
- Implementation code MUST be produced only through the Spec Kit `implement` workflow
  against an approved plan and task list — never hand-written outside it, and never
  before the relevant spec, plan, and tasks are approved.
- Runtime development guidance lives in `.specify/` templates and `docs/` mapping files.

**Version**: 1.3.0 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-10-07

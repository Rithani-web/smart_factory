<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles: VI. Course Fidelity & Simplicity (stack enumeration corrected —
  no change to principle intent)
- Added sections: none (Fixed Technology Stack & Domain Fidelity materially expanded
  with the authoritative stack: TS frontend/backend, JWT/RBAC auth)
- Removed sections: none
- Follow-up TODOs: test runner (Vitest vs Jest) deferred to spec/001 plan time
- Reason for MINOR bump: materially expanded/corrected stack guidance from authoritative
  project brief; no principle added, removed, or redefined
-->

# Smart Factory Production Automation System Constitution

## Core Principles

### I. Specification-First

No feature work begins before an approved specification exists. Every increment of this
system MUST be expressed as a specification (Spec Kit `specify`) that states the desired
behavior in unambiguous, testable language before any planning or implementation occurs.
Rationale: the course's central claim — specifications, not prompts, drive AI-assisted
engineering; ad-hoc prompting produces the "illusion of completeness".

### II. Contracts are Testable Agreements

Every behavioral claim in a specification MUST be written as a contract: a concrete,
machine-verifiable statement of expected system behavior (given input → expected outcome).
A claim that cannot be verified by an executed check MUST be rewritten or removed.
Rationale: contracts convert prose requirements into acceptance criteria that verification
can gate on.

### III. Clarification Gates (NON-NEGOTIABLE)

Ambiguity MUST be resolved before planning, never guessed by AI. Underspecified areas in a
specification are resolved through a clarification pass (`clarify`) that asks targeted
questions and encodes the answers back into the spec. Implementation MUST NOT start while a
material ambiguity remains open. Rationale: silent guessing is the primary failure mode of
AI-assisted development; the gate makes assumptions explicit and approved.

### IV. Verification & Convergence (NON-NEGOTIABLE)

An implementation is DONE only when its behavior is verified against the specification.
Each feature MUST run a verification pass comparing implementation behavior with the
spec's contracts, and MUST iterate (implement → verify) until checks report convergence.
Missing verification is not a successful implementation. Rationale: the course defines
completion as convergence with the contract, not as "code that was written".

### V. Schema & Contract Decoupling

Data models (schema) and behavioral contracts MUST be designed independently of
implementation details. Specifications and contracts MUST NOT name internal classes,
functions, or file layouts; they MUST describe observable data and behavior only.
Implementation selects structures that satisfy the contracts. Rationale: the course teaches
contract modeling as separable from implementation so the spec survives implementation
choices.

### VI. Course Fidelity & Simplicity

This project is the course's incident-management exercise with the domain substituted to
Smart Factory Production Automation. Architecture, complexity, spec structure
(spec/001–004), and workflow MUST mirror the original course exercise (see
`docs/ORIGINAL-BASELINE.md`, `docs/DOMAIN-MAPPING.md`). Where manufacturing realism
conflicts with course fidelity, course fidelity wins. No technology MAY be added beyond
the fixed stack: no IoT, ML, predictive maintenance, microservices, or event streaming.
Rationale: the purpose is learning the course's SDD method exactly; additions dilute the
exercise.

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
- Testing: contract tests assert observable API behavior against the specs; runner
  (Vitest or Jest) chosen at spec/001 plan time and then fixed.
- Terminology: incident → production/machine event; on-call engineer → on-duty
  technician; on-call roster → technician/maintenance roster; escalation → maintenance
  escalation; acknowledgement → technician acknowledgement; resolution → issue
  resolution. Full mapping: `docs/DOMAIN-MAPPING.md`.

## Development Workflow & Quality Gates

- Lifecycle per feature: `specify` → `clarify` (gate) → `plan` → `roadmap/tasks` →
  `implement` → `verify`/`converge`, run in that order without skipping gates.
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

**Version**: 1.1.0 | **Ratified**: 2026-10-07 | **Last Amended**: 2026-10-07

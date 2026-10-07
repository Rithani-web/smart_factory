# ORIGINAL-BASELINE — what the Nebula KnowLab course project actually requires

Source: user-provided course summary (pasted 2026-10-07), the official public course page, and the
detailed project description the user supplied. Lesson-by-lesson academy content was NOT available;
where something is unknown it is marked UNKNOWN — never invented.

## Original project (reference only — we do NOT build this)

An automated **Incident Management System**, built Greenfield as a hands-on lab for the
"Spec-Driven Development with AI" course (module 01 — Greenfield Spec-Driven Development).

## Confirmed original stack (authoritative per user's project brief, 2026-10-07)

| Concern | Original choice |
|---|---|
| Frontend | TypeScript · React · Vite · Tailwind CSS — at `/frontend` |
| Backend | TypeScript · Node.js · Express · Prisma — at `/backend` |
| Database | PostgreSQL hosted on **Neon** (course explicitly configures this) |
| Auth | JWT (access + refresh tokens), HTTP-only cookies, server-side RBAC — roles: **Admin, Responder, Viewer** |
| Email | **Resend** |
| Method/lifecycle | **GitHub Spec Kit** driven through **Claude Code** |

Note: the user's `DATABASE_URL` in `.env` is already a Neon PostgreSQL instance — matches the original.
The original role name "Responder" is incident-management vocabulary (→ Technician in our domain).

## Original behavior flow (incident domain)

Incident occurs → Create incident → Assign person/team → Check who's on-call → Send notification
→ No response? → Escalate → Acknowledge → Resolve

## Original spec progression

| Spec | Title (original) | Intent |
|---|---|---|
| spec/001 | MVP Incident Lifecycle | Core create → assign → notify → acknowledge → resolve flow |
| spec/002 | On-call Rosters and Escalation Rules | Roster lookup; no-response timer; escalation tiers |
| spec/003 | Advanced Execution | Advanced execution behaviors (details UNKNOWN) |
| spec/004 | Advanced Execution and Verification | Contract verification; missing verification ≠ done |

## Course vocabulary (must be preserved in our artifacts)

- **Contract** — "a testable agreement describing expected system behavior"
- **Clarification gate** — resolve ambiguity before implementation rather than letting AI guess
- **Verification** — check the implementation actually satisfies the specification
- **Convergence loop** — repeatedly compare result with spec and fix gaps until it matches
- **"Illusion of completeness"** — reduced via clarification gates + verification/convergence loops
- **Spec Kit lifecycle stages** — Specify → Clarify → Plan → Roadmap → Tasks → Implement → Verify
- **Progressive levels** — spec-guided workflows → structured/automated → spec-as-source

## Course outcomes the exercise must demonstrate

1. Core SDD principles and the paradigm shift in AI-assisted engineering
2. Specifications guiding planning, design, implementation, verification
3. Greenfield vs Brownfield vs Hybrid distinction
4. Schema/contract modeling decoupled from implementation
5. Architect/orchestrator mindset: define what → guide AI execution → verify result against spec

## UNKNOWNs (do not invent; follow Spec Kit standard practice and say so)

- Exact REST endpoints, request/response schemas of the original
- Exact escalation timing values (e.g., minutes before escalation fires)
- Exact test/contract-verification tooling used by the course
- Lesson-by-lesson academy content

# DOMAIN-MAPPING — Incident Management → Smart Factory Production Automation

Rule (user-set): **domain substitution ONLY.** Same methodology, lifecycle, spec structure/intent,
architecture, DB/API/notification/testing approach, complexity, and project organization.
When "more realistic for manufacturing" conflicts with "preserves the course original", the
course original wins. No IoT / ML / predictive maintenance / microservices / event-streaming.

## Core terminology

| Original (Incident Management) | Ours (Smart Factory Production Automation) |
|---|---|
| Incident | Production / Machine Event |
| Incident lifecycle | Production Event Lifecycle |
| Incident severity | Production Impact / Severity |
| On-call engineer | On-duty Technician |
| On-call roster | Technician / Maintenance Roster |
| Incident assignment | Production Event / Technician Assignment |
| Incident escalation | Maintenance / Production Escalation |
| Incident notification | Production / Maintenance Notification |
| Incident acknowledgement | Technician Acknowledgement |
| Incident resolution | Production / Machine Issue Resolution |
| Incident history | Production Event History |
| Role: Responder | Technician / Production Responder |
| Role: Admin | Admin (unchanged) |
| Role: Viewer | Viewer (unchanged) |

## Spec titles (structure and intent preserved)

| Original | Ours |
|---|---|
| spec/001 — MVP Incident Lifecycle | spec/001 — MVP Production Event Lifecycle |
| spec/002 — On-call Rosters and Escalation Rules | spec/002 — Technician Rosters and Escalation Rules |
| spec/003 — Advanced Execution | spec/003 — Advanced Production Automation |
| spec/004 — Advanced Execution and Verification | spec/004 — Advanced Execution and Verification |

## Stack mapping (nothing changes except wording)

| Concern | Original | Ours |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS, TypeScript, `/frontend` | **Same** |
| Backend | Node.js + Express + Prisma, TypeScript, `/backend` | **Same** |
| Auth | JWT (access + refresh), HTTP-only cookies, server-side RBAC (Admin/Responder/Viewer) | **Same** — roles worded Admin/Technician (Production Responder)/Viewer |
| Database | Neon serverless PostgreSQL | **Same** Neon PostgreSQL (user's `.env`) |
| Notifications | Resend API (email) | **Same** Resend API — emails worded as production/maintenance alerts |
| Lifecycle | Spec Kit via Claude Code | Same |
| Flow | create → assign → on-call check → notify → escalate on no-response → acknowledge → resolve | create event → assign technician → duty-roster check → notify → escalate on no-response → acknowledge → resolve |

## Naming conventions for artifacts

- Entities: `ProductionEvent`, `Technician`, `MaintenanceRoster`, `EscalationPolicy`, `Notification`
- Endpoints/events use production-event wording (`/production-events`, acknowledge, resolve, escalate)
- Tests/contracts assert production-event behavior with the same acceptance structure as the originals

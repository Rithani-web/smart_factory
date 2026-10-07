# Implementation Plan: Dashboard, Public Status Page & Hardening

**Branch**: `004-advanced-execution-verification` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

## Summary

One cohesive release: (1) an operations dashboard — severity counters, per-team
on-call, SLA compliance rate, Recharts volume trend, team+period filters with
role-based defaults; (2) a public, unauthenticated Statuspage-quality factory status
page driven by derived per-team status with Admin manual overrides; (3) hardening —
exhaustive state-machine/escalation/SLA test coverage on synthetic time, RBAC
edge-case tests, a rich demo seed, and a token-based design system (palette,
spacing, typography, layout shell, skeletons) applied to every touched view.

## Technical Context

Unchanged stack + **Recharts** (constitution v1.3.0) and the scoped public surface.
One new table (`StatusMessage`); everything else computed at request time from
existing models.

## Constitution Check

| Principle | Gate | Status |
|-----------|------|--------|
| I. Spec-Driven Development | spec + clarify 5/5 + checklist 16/16; implement via tasks | ✅ PASS |
| II. Mandatory Server-Side Authorization | only `/api/public/*` is unauthenticated (v1.3.0 scope, data-minimal, tested); all else behind existing middleware | ✅ PASS |
| III. End-to-End TypeScript Types | dashboard/status DTOs in shared/types | ✅ PASS |
| IV. Single Source of Truth for Schema | one migration adds StatusMessage; dashboard/status derived, never stored | ✅ PASS |
| V. Secure Authentication by Default | public surface carries zero personal data (asserted in tests) | ✅ PASS |
| VI. Course Fidelity & Simplicity | Recharts + public page are brief-mandated and now sanctioned; no other additions | ✅ PASS |

## Project Structure

```text
backend/src/dashboard/service.ts + routes.ts   # GET /api/dashboard/summary (auth)
backend/src/status/derive.ts                   # pure severity→status mapping
backend/src/status/service.ts + public routes  # GET /api/public/status (NO auth)
backend/src/status/adminRoutes.ts              # PUT/DELETE /api/teams/:id/status-message (ADMIN)
backend/prisma/schema.prisma                   # +StatusMessage
frontend/src/theme.css                         # design tokens (palette/spacing/type)
frontend/src/components/{Layout,Card,Skeleton,Empty,Error,Badges}.tsx
frontend/src/pages/Dashboard.tsx               # Recharts panels + filters
frontend/src/pages/StatusPublic.tsx            # /status — public
frontend/src/App.tsx                           # shell with sidebar; public route
```

Design artifacts: [research.md](./research.md) · [data-model.md](./data-model.md) ·
[contracts/rest-api.md](./contracts/rest-api.md) · [quickstart.md](./quickstart.md)

## Complexity Tracking

No violations — Recharts/public surface sanctioned by constitution v1.3.0.

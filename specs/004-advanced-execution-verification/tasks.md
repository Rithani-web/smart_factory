# Tasks: Dashboard, Public Status Page & Hardening (spec/004)

**Prerequisites**: plan.md ✅ · spec.md ✅ (clarified 5/5) · research.md ✅ (D21–D25) · data-model.md ✅ · contracts/rest-api.md ✅ · quickstart.md ✅

**Tests**: REQUIRED; all time-dependent tests on injected clocks — zero sleeps.

## Phase 1: Governance, Schema & Core Backend

- [ ] T001 Constitution amended to v1.3.0 (Recharts + scoped public surface) — done
      in this commit; recorded here for traceability
- [ ] T002 Add StatusMessage (teamId unique, message ≤280, authorId, createdAt) to
      `backend/prisma/schema.prisma`; migrate (diff + deploy); commit migration
- [ ] T003 [P] Add `shared/types/src/dashboard.ts` + `status.ts`: TeamOperationalStatus
      enum (OPERATIONAL/DEGRADED/PARTIAL_OUTAGE/MAJOR_OUTAGE), PublicStatusDTO,
      StatusMessageDTO, DashboardSummaryDTO (+volume/SLA/team panels),
      SetStatusMessageRequest; re-export (Constitution III)
- [ ] T004 [P] Unit tests `backend/tests/unit/status-derive.test.ts` — pure
      `deriveTeamStatus(openSeverities)` matrix: none/LOW/MEDIUM/HIGH/CRITICAL/mixed
      (highest wins) (FR-304, D21)
- [ ] T005 Implement `backend/src/status/derive.ts` (pure) + `service.ts`
      (public payload assembly incl. counts + active overrides) + public route
      `GET /api/public/status` mounted BEFORE auth in `backend/src/app.ts` (FR-303,
      D23); turn T004 green
- [ ] T006 Contract test `backend/tests/contract/public-status.contract.test.ts`:
      200 unauthenticated; derived mapping vs seeded events; override set/clear via
      admin routes reflected; payload minimality scan (no '@', no assignee names);
      override author name present (US2-1…2-5, FR-311)

## Phase 2: Overrides, Dashboard & Hardening Tests

- [ ] T007 Implement `backend/src/status/adminRoutes.ts`: PUT/DELETE
      `/api/teams/:id/status-message` (ADMIN, 1–280 chars) behind auth+pending gates
      (FR-305)
- [ ] T008 Implement `backend/src/dashboard/service.ts` + `routes.ts`:
      `GET /api/dashboard/summary` — four parallel aggregates, team+days filters,
      non-admin default = memberships (fallback all), compliance excludes PENDING
      (FR-301/302, D22)
- [ ] T009 Contract test `backend/tests/contract/dashboard.contract.test.ts`:
      seeded fixture → counts/on-duty/compliance(8/10=80%)/bucket sums; non-admin
      default filter; viewer 200 read-only; 401 unauthenticated (SC-301, US1-*)
- [ ] T010 Unit test `backend/tests/unit/state-machine.test.ts`: exhaustive
      status×action×role matrix through the events service — every legal cell
      succeeds with history, every illegal cell asserts exact 403/409 (FR-309, D24)
- [ ] T011 RBAC edge-case tests `backend/tests/contract/rbac-edges.contract.test.ts`:
      unauthenticated 401 across protected routers; pending-password gate on
      dashboard/teams/status-message routes; non-admin PUT/DELETE status-message →
      403; public route is the ONLY unauthenticated 200 (FR-311)
- [ ] T012 Rich seed `backend/prisma/seed.ts`: 3 teams with staggered rotations,
      users in all roles (+ second admin), events in Open/Acknowledged/Resolved
      across all severities incl. one back-dated open CRITICAL (SLA-breached) and
      one manual status message (FR-310)

## Phase 3: Frontend Design System, Dashboard & Status Page

- [ ] T013 Design system: `frontend/src/theme.css` tokens (palette, spacing, type
      scale); primitives `components/ui.tsx` (Card/PanelHeader, Skeleton, EmptyState,
      ErrorState, StatusDot, buttons); app shell `components/AppShell.tsx` (sidebar
      nav desktop / top bar tablet, main content) — retrofit EventsList, EventDetail,
      Login, Teams to the system (FR-308/312, D25)
- [ ] T014 Add recharts to frontend; `pages/Dashboard.tsx`: four severity stat cards,
      on-call panel, SLA compliance card, volume AreaChart (Recharts, legend, axes,
      empty-data state), team+period filters wired to the summary endpoint, skeleton/
      empty/error states (FR-301/302/306)
- [ ] T015 `pages/StatusPublic.tsx` at public route `/status` (outside RequireAuth):
      overall banner (worst status), per-team rows with StatusDot + open counts,
      manual overrides visually marked, last-updated stamp, responsive tablet+
      desktop (FR-307)
- [ ] T016 Full gate: `npm test` all green, `tsc --noEmit` both sides, eslint clean,
      FR-coverage matrix FR-301…312 in completion output, quickstart walkthrough
      (incognito /status + dashboard filters + override set/clear)

## Dependencies

T002 → T005/T007/T012; T003 → T005/T007/T008/T014/T015; T004 → T005; T005 → T006;
T007+T008 → T009/T011; T013 → T014/T015; T016 last.

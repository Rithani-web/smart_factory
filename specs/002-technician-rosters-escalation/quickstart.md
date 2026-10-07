# Quickstart: run & validate spec/002 (Rosters & Escalation)

Prereqs: spec/001 quickstart completed (app runs, DB migrated). Then:

```bash
npx prisma migrate deploy --schema backend/prisma/schema.prisma   # applies spec/002 migration
npm run seed -w backend        # reseed: demo team + rotation + policies
```

## Validation scenario (mocked-time engine, real UI for rosters)

1. Sign in as admin → **Teams** shows the seeded team (weekly rotation, ordered
   members, who is on duty right now). Any role can view this page; only ADMIN sees
   edit controls (server enforces too).
2. Sign in as `tech@factory.local` → try modifying a team via the API → **403**.
3. Report a **CRITICAL** event as any of admin/technician → assigned to the on-duty
   technician; history shows `CREATED, ASSIGNED`; `ackDeadline = +5 min` (CRITICAL
   default policy).
4. Don't acknowledge it. The in-process evaluator ticks every 30 s — within ~35 s the
   event is **reassigned to the next rotation member**, history gains
   `ESCALATED (SYSTEM — "A → B (CRITICAL unacknowledged 5m)")`, and the new assignee's
   notification is recorded.
5. Leave it unacknowledged through the remaining rotation members → final step:
   assigned to the **designated Admin**, `ackDeadline` cleared — terminal (FR-109).
6. Acknowledge a fresh CRITICAL event before 5 minutes → no escalation ever fires.
7. **Automated proof (no waiting)**: `npm test -w backend` — the escalation suite
   drives `runEscalationTick` with synthetic timestamps (FR-113): 6 minutes pass
   instantly in test time.

## Negative checks

- VIEWER/TECHNICIAN: PUT /teams, PUT /escalation-policies → 403 (server-side).
- LOW severity event: never escalates regardless of age.
- RESOLVED event: never escalates.
- Two evaluator ticks at the same deadline: exactly one `ESCALATED` entry (FR-111).

# Quickstart: run & validate spec/003 (SLA targets & tracking)

Prereqs: spec/002 quickstart completed. Then:

```bash
npx prisma migrate deploy --schema backend/prisma/schema.prisma   # SlaTarget table
npm run seed -w backend        # seeds default SLA targets
```

## Validation scenario

1. Sign in → **Teams/Events**: each event row may show an **SLA ⚠** indicator when any
   dimension is breached.
2. Open an event → SLA panel shows both dimensions: target, actual, status chip
   (MET green / BREACHED red / PENDING neutral).
3. Report a CRITICAL event and **don't** acknowledge it → after 5 minutes (default)
   the detail view flips the acknowledge SLA to BREACHED on refresh — no resolution
   needed (FR-206; evaluator-free, computed at read).
4. Acknowledge a fresh CRITICAL event within 5 minutes → acknowledge SLA reads MET
   with the actual duration; resolve dimension stays PENDING until due.
5. Resolve events within/after their targets → resolve SLA reflects MET/BREACHED.
6. As ADMIN: change the CRITICAL acknowledge target via `PUT /api/sla-targets` → the
   change is visible to every role and applies to displayed status immediately
   (computed at read).
7. As VIEWER/TECHNICIAN: attempt the PUT → **403**.

## Automated proof (no waiting)

`npm test -w backend` — the engine suite drives all six mandatory scenarios with
synthetic timestamps (FR-113-style injected clock): hours pass in microseconds.

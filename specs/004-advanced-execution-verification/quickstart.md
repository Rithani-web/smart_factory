# Quickstart: validate spec/004 (Dashboard, Status Page, Hardening)

```bash
npx prisma migrate deploy --schema backend/prisma/schema.prisma
npm run seed -w backend        # rich demo dataset (teams, users, events, 1 SLA breach)
npm run dev:backend & npm run dev:frontend
```

## Walkthrough

1. **/status (no login — incognito window)**: Statuspage-quality page; overall banner;
   one row per team with a status dot; the seeded CRITICAL open event puts its team in
   **Major Outage** (derived); a team with a manual message shows it labeled
   **Manual override**.
2. Sign in as admin → **Dashboard**: four severity counters matching the seed; on-call
   panel (rotation-computed); SLA compliance stat; Recharts volume trend; switch team
   filter and period — all panels refilter.
3. Sign in as technician → dashboard defaults to their team; switching teams is
   read-only; no admin controls anywhere.
4. Admin: set a status message on a healthy team → public page flips it to the
   override with the marker; clear it → derived status resumes.
5. States: stop the backend → every view shows its error state (no blank screens);
   empty DB → empty states + zeroed dashboard + all-Operational status page.

## Hardening proof

`npm test -w backend` — state-machine matrix (every status×action×role cell),
escalation + SLA suites (synthetic time), RBAC edge cases, public-payload minimality
scan — all green, zero sleeps.

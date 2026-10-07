# Quickstart: run & validate spec/001 (MVP Production Event Lifecycle)

Validation guide only — implementation details live in `tasks.md` and the
implementation phase. Prerequisites: **Node.js 20+**, npm, your Neon `DATABASE_URL`.

## 1. One-time setup

```bash
npm install                      # root — installs all workspaces
cp backend/.env.example backend/.env   # then fill real values (DATABASE_URL already known)
npx prisma migrate deploy --schema backend/prisma/schema.prisma   # or: migrate dev
npm run seed -w backend          # optional demo data (see 3.)
```

`.env` must contain: `DATABASE_URL` (Neon pooled), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`RESEND_API_KEY`, `MAIL_FROM` — real values, never committed (Constitution V).

## 2. Run it (two terminals)

```bash
npm run dev -w backend     # API  → http://localhost:3000/api
npm run dev -w frontend    # UI   → http://localhost:5173  ← open this in your browser
```

## 3. End-to-end validation scenario (proves the spec)

1. **Sign in** at the UI as the seeded admin → lands on the events list (empty state OK).
2. **Create a technician**: Users → new Technician (name + email) → note the shown
   **temporary password** (shown exactly once).
3. **Sign in as the technician** with the temp password → you are forced onto the
   **set-new-password** screen before anything else (FR-019). Set it.
4. As admin: give the technician a **duty roster entry** covering *now* (seed or roster UI).
5. **Create a production event** (admin or technician): e.g.
   title "Packaging line 2 jammer fault", severity HIGH, machine/line "Line 2".
   → **Expected**: event appears with status **ASSIGNED** (SC-001/SC-002), assignee shows
   **name + role only** (FR-018), and the technician's inbox receives the notification
   email with the event details (SC-003). History shows `CREATED` + `ASSIGNED`.
6. **As the technician**: open the event → **Acknowledge** → status `ACKNOWLEDGED`,
   history gains the entry (SC-004).
7. **As the technician**: **Resolve** with notes → status `RESOLVED`, notes + resolver +
   time recorded.
8. **Negative checks (all must be rejected — SC-005)**:
   - signed out: any URL → login wall (401);
   - as VIEWER: no create/reassign buttons and direct API call → 403;
   - technician on someone else's event: acknowledge → 403;
   - fresh event: technician tries resolve before acknowledge → 409 `MUST_ACKNOWLEDGE_FIRST`;
   - resolve with empty notes → 400;
   - non-admin tries Users/Reassign → 403.

## 4. Tests

```bash
npm test -w backend      # Vitest + Supertest: contract suites (RBAC matrix, lifecycle
                         # transitions, validation) + integration lifecycle walk
npm test -w frontend     # component/render tests
```

Green = every FR-001…019 has a passing contract or integration check. The
implement→verify loop (Constitution: verification & convergence) repeats until green.

## 5. If something fails

- **DB connection**: check `.env` `DATABASE_URL` (pooled string) and that the Neon
  instance is awake (free tier suspends when idle — reopening the console wakes it).
- **No email arrives**: check `RESEND_API_KEY` / `MAIL_FROM`; note the event still
  records the attempt as `FAILED` (FR-010) — assignment is never silently lost.
- **403 PASSWORD_CHANGE_REQUIRED everywhere**: that's the first-password gate working;
  complete the change once (step 3).

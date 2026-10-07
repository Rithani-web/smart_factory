import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app, loginAs, resetDb, seedUser } from '../helpers.ts';

/**
 * RBAC edge cases (FR-311): every protected router 401s unauthenticated; the
 * pending-password gate covers NEW endpoints; the public route is the ONLY
 * unauthenticated 200.
 */
describe('RBAC edge cases (FR-311)', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
  });

  const protectedGets = [
    '/api/events',
    '/api/teams',
    '/api/users',
    '/api/sla-targets',
    '/api/escalation-policies',
    '/api/dashboard/summary',
  ];

  it('every protected GET rejects unauthenticated with 401', async () => {
    for (const path of protectedGets) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(401);
    }
  });

  it('the ONLY unauthenticated 200 is the public status surface', async () => {
    expect((await request(app).get('/api/public/status')).status).toBe(200);
    expect((await request(app).get('/api/health')).status).toBe(200); // liveness only
  });

  it('pending-password gate covers the new endpoints (FR-019 consistency)', async () => {
    const admin = await loginAs('admin@test.local');
    const created = await admin
      .post('/api/users')
      .send({ name: 'Fresh Tech', email: 'fresh@test.local', role: 'TECHNICIAN' });
    const temp = created.body.temporaryPassword as string;

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'fresh@test.local', password: temp });

    for (const path of ['/api/dashboard/summary', '/api/teams', '/api/sla-targets']) {
      const res = await agent.get(path);
      expect(res.status, path).toBe(403);
      expect(res.body.error.code, path).toBe('PASSWORD_CHANGE_REQUIRED');
    }

    await agent
      .post('/api/auth/complete-password-change')
      .send({ newPassword: 'Fresh#Password1' });
    expect((await agent.get('/api/dashboard/summary')).status).toBe(200);
  });
});

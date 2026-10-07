import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { ERROR_CODES } from '@smart-factory/types';

import {
  app,
  loginAs,
  resetDb,
  seedUser,
} from '../helpers.ts';

describe('US1 first-password gate (FR-019, research D10)', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
  });

  it('forces a temp-password user to change password before anything else', async () => {
    // Admin provisions a fresh technician (temporary password returned once).
    const admin = await loginAs('admin@test.local');
    const created = await admin.post('/api/users').send({
      name: 'New Tech',
      email: 'newtech@test.local',
      role: 'TECHNICIAN',
    });
    expect(created.status).toBe(201);
    expect(created.body.user).toEqual({ id: expect.any(String), name: 'New Tech', role: 'TECHNICIAN' });
    expect(created.body.user.email).toBeUndefined(); // FR-018
    const tempPassword = created.body.temporaryPassword as string;
    expect(tempPassword).toBeTruthy();

    // Sign in with the temporary password.
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'newtech@test.local', password: tempPassword });
    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);

    // EVERY other endpoint is gated (FR-019: "before any other action") — for the
    // AUTHENTICATED temp-password user.
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'newtech@test.local', password: tempPassword });
    const gated = await agent.get('/api/events');
    expect(gated.status).toBe(403);
    expect(gated.body.error.code).toBe(ERROR_CODES.PASSWORD_CHANGE_REQUIRED);

    // Weak password rejected.
    const weak = await agent.post('/api/auth/complete-password-change').send({ newPassword: 'short' });
    expect(weak.status).toBe(400);

    // Valid change unlocks the account.
    const done = await agent
      .post('/api/auth/complete-password-change')
      .send({ newPassword: 'MyNew#Password9' });
    expect(done.status).toBe(200);
    expect(done.body.user.mustChangePassword).toBe(false);

    const unlocked = await request(app).get('/api/events');
    expect(unlocked.status).toBe(401); // no cookies on plain request
    const fresh = request.agent(app);
    await fresh
      .post('/api/auth/login')
      .send({ email: 'newtech@test.local', password: 'MyNew#Password9' });
    expect((await fresh.get('/api/events')).status).toBe(200);

    // Old temporary password no longer works.
    const old = await request(app)
      .post('/api/auth/login')
      .send({ email: 'newtech@test.local', password: tempPassword });
    expect(old.status).toBe(401);

    // Duplicate email rejected (contract: EMAIL_TAKEN 409).
    const dup = await admin.post('/api/users').send({
      name: 'Dup',
      email: 'newtech@test.local',
      role: 'VIEWER',
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe(ERROR_CODES.EMAIL_TAKEN);
  });
});

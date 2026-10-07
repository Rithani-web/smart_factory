import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { ERROR_CODES } from '@smart-factory/types';

import {
  app,
  loginAs,
  resetDb,
  seedUser,
  TEST_PASSWORD,
} from '../helpers.ts';

describe('US1 auth & RBAC (FR-001/002/003/016, SC-005)', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
    await seedUser('Duty Tech', 'tech@test.local', 'TECHNICIAN');
    await seedUser('Floor Viewer', 'viewer@test.local', 'VIEWER');
  });

  describe('login', () => {
    it('returns 200 with httpOnly cookies and the session user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.local', password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        name: 'Plant Admin',
        role: 'ADMIN',
        mustChangePassword: false,
      });
      expect(res.body.user.email).toBeUndefined(); // FR-018
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.join(' ')).toContain('sf_access');
      expect(cookies.join(' ')).toContain('HttpOnly');
    });

    it('rejects bad credentials with 401 INVALID_CREDENTIALS', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.local', password: 'wrong' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
    });
  });

  it('401 for unauthenticated access to events (FR-001)', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(401);
  });

  it('403 for VIEWER create-event (FR-002/016)', async () => {
    const viewer = await loginAs('viewer@test.local');
    const res = await viewer.post('/api/events').send({ title: 'x' });
    expect(res.status).toBe(403);
  });

  it('403 for VIEWER and TECHNICIAN on users list (FR-002/016)', async () => {
    const viewer = await loginAs('viewer@test.local');
    expect((await viewer.get('/api/users')).status).toBe(403);
    const tech = await loginAs('tech@test.local');
    expect((await tech.get('/api/users')).status).toBe(403);
  });

  describe('session persistence + logout (FR-003)', () => {
    let admin: request.Agent;

    beforeEach(async () => {
      admin = await loginAs('admin@test.local');
    });

    it('stays authenticated across requests and can sign out', async () => {
      expect((await admin.get('/api/events')).status).toBe(200);
      const out = await admin.post('/api/auth/logout');
      expect(out.status).toBe(204);
      expect((await admin.get('/api/events')).status).toBe(401);
    });
  });
});

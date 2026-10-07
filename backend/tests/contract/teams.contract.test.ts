import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import {
  app,
  loginAs,
  resetDb,
  seedUser,
  TEST_PASSWORD,
} from '../helpers.ts';

describe('US1 teams API (FR-101…105, FR-104)', () => {
  let adminId: string;
  let techA: { id: string };
  let techB: { id: string };

  beforeAll(async () => {
    await resetDb();
    const admin = await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
    adminId = admin.id;
    techA = await seedUser('Tech A', 'a@test.local', 'TECHNICIAN');
    techB = await seedUser('Tech B', 'b@test.local', 'TECHNICIAN');
    await seedUser('Floor Viewer', 'viewer@test.local', 'VIEWER');
  });

  function teamBody(overrides: Record<string, unknown> = {}) {
    return {
      name: 'Line Maintenance',
      cadence: 'WEEKLY',
      // anchor 1h ago on a weekly cadence → position 0 on duty
      anchorAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      memberIds: [techA.id, techB.id],
      escalationAdminId: adminId,
      ...overrides,
    };
  }

  it('ADMIN creates a team; any role can view it with rotation state', async () => {
    const admin = await loginAs('admin@test.local');
    const created = await admin.post('/api/teams').send(teamBody());
    expect(created.status).toBe(201);
    expect(created.body.members.map((m: { position: number }) => m.position)).toEqual([0, 1]);
    expect(created.body.onDuty).toMatchObject({ name: 'Tech A' });
    expect(created.body.escalationAdmin).toMatchObject({ name: 'Plant Admin' });

    for (const email of ['viewer@test.local', 'a@test.local']) {
      const agent = await loginAs(email, TEST_PASSWORD);
      const view = await agent.get('/api/teams');
      expect(view.status).toBe(200);
      expect(view.body[0].onDuty.name).toBe('Tech A');
    }
  });

  it('rotation state advances with the anchor (US1-2 through the API)', async () => {
    const admin = await loginAs('admin@test.local');
    // anchor 8 days ago → position 1 (one full week + 1 day elapsed)
    await admin.put('/api/teams/first').send().catch(() => {});
    const list = await admin.get('/api/teams');
    const teamId = list.body[0].id as string;
    const updated = await admin.put(`/api/teams/${teamId}`).send(
      teamBody({ anchorAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() }),
    );
    expect(updated.status).toBe(200);
    expect(updated.body.onDuty).toMatchObject({ name: 'Tech B' });
  });

  it('writes are ADMIN-only, enforced server-side (FR-104, US1-4)', async () => {
    const viewer = await loginAs('viewer@test.local');
    const tech = await loginAs('a@test.local');
    for (const agent of [viewer, tech]) {
      expect((await agent.post('/api/teams').send(teamBody())).status).toBe(403);
      expect((await agent.get('/api/teams')).status).toBe(200);
    }
    const anon = await request(app).get('/api/teams');
    expect(anon.status).toBe(401);
  });

  it('400 on non-technician member and empty member list (FR-101)', async () => {
    const admin = await loginAs('admin@test.local');
    const viewer = await seedUser('Just Viewer', 'v2@test.local', 'VIEWER');
    const badRole = await admin
      .post('/api/teams')
      .send(teamBody({ name: 'Bad', memberIds: [viewer.id] }));
    expect(badRole.status).toBe(400);
    const empty = await admin
      .post('/api/teams')
      .send(teamBody({ name: 'Empty', memberIds: [] }));
    expect(empty.status).toBe(400);
  });

  it('404 updating an unknown team', async () => {
    const admin = await loginAs('admin@test.local');
    const res = await admin.put('/api/teams/nope').send(teamBody());
    expect(res.status).toBe(404);
  });
});

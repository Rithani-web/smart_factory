import { beforeAll, afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { getPrisma } from '../../src/shared/prisma.ts';
import {
  app,
  cleanEvents,
  createEventViaApi,
  loginAs,
  resetDb,
  seedTeam,
  seedUser,
  useFakeMailer,
} from '../helpers.ts';

describe('US1 dashboard summary (FR-301/302, SC-301)', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
    await seedUser('Tech A', 'a@test.local', 'TECHNICIAN');
    await seedUser('Floor Viewer', 'viewer@test.local', 'VIEWER');
    useFakeMailer();
  });

  afterEach(cleanEvents);

  it('unauthenticated → 401 (only /api/public/* is open)', async () => {
    expect((await request(app).get('/api/dashboard/summary')).status).toBe(401);
  });

  it('severity counters, on-duty, volume buckets match the seeded fixture (US1-1/1-2)', async () => {
    const tech = await getPrisma().user.findUniqueOrThrow({ where: { email: 'a@test.local' } });
    await seedTeam([tech.id], { name: 'Line A' });
    const admin = await loginAs('admin@test.local');
    await createEventViaApi(admin, { severity: 'CRITICAL', title: 'Open critical' });
    await createEventViaApi(admin, { severity: 'HIGH', title: 'Open high' });
    await createEventViaApi(admin, { severity: 'HIGH', title: 'Second high' });

    const res = await admin.get('/api/dashboard/summary?days=7');
    expect(res.status).toBe(200);
    expect(res.body.openBySeverity).toEqual({ CRITICAL: 1, HIGH: 2, MEDIUM: 0, LOW: 0 });
    expect(res.body.teams[0]).toMatchObject({ name: 'Line A', onDutyName: 'Tech A' });
    const bucketSum = res.body.volume.reduce(
      (a: number, b: { count: number }) => a + b.count,
      0,
    );
    expect(bucketSum).toBe(3); // all three created today → today's bucket
    expect(res.body.volume).toHaveLength(7);
    expect(res.body.appliedFilter).toEqual({ teamId: null, days: 7 });
  });

  it('SLA compliance: 8 of 10 due events met → 80% (US1-3, clarified Q2)', async () => {
    const tech = await getPrisma().user.findUniqueOrThrow({ where: { email: 'a@test.local' } });
    await seedTeam([tech.id], { name: 'Line A' });
    const db = getPrisma();
    const now = Date.now();

    // 10 due events created within the window: 8 met both SLAs (acked + resolved fast),
    // 2 breached (resolved late). PENDING events excluded from the denominator.
    for (let i = 0; i < 8; i++) {
      const created = new Date(now - 3 * 60 * 60 * 1000); // 3h ago
      const e = await db.productionEvent.create({
        data: {
          title: `Met ${i}`,
          description: 'x',
          machineRef: 'Line A',
          severity: 'MEDIUM',
          status: 'RESOLVED',
          reporterId: tech.id,
          acknowledgedAt: new Date(created.getTime() + 60_000),
          resolvedAt: new Date(created.getTime() + 2 * 60 * 60 * 1000),
          resolvedById: tech.id,
          resolutionNotes: 'ok',
        },
      });
      void e;
    }
    for (let i = 0; i < 2; i++) {
      await db.productionEvent.create({
        data: {
          title: `Breached ${i}`,
          description: 'x',
          machineRef: 'Line A',
          severity: 'LOW',
          status: 'RESOLVED',
          reporterId: tech.id,
          createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
          acknowledgedAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000),
          resolvedAt: new Date(now - 3 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
          resolvedById: tech.id,
          resolutionNotes: 'late',
        },
      });
    }

    const admin = await loginAs('admin@test.local');
    const res = await admin.get('/api/dashboard/summary?days=7');
    expect(res.body.sla.total).toBe(10);
    expect(res.body.sla.met).toBe(8);
    expect(res.body.sla.rate).toBeCloseTo(0.8, 5);
  });

  it('non-admin defaults to own team; explicit filter permitted read-only (US1-4)', async () => {
    const tech = await getPrisma().user.findUniqueOrThrow({ where: { email: 'a@test.local' } });
    const teamId = await seedTeam([tech.id], { name: 'My Team' });
    const techAgent = await loginAs('a@test.local');
    const res = await techAgent.get('/api/dashboard/summary');
    expect(res.body.appliedFilter).toEqual({ teamId, days: 7 });

    const viewer = await loginAs('viewer@test.local');
    const vres = await viewer.get('/api/dashboard/summary?days=30');
    expect(vres.status).toBe(200); // read-only access for all roles
    expect(vres.body.appliedFilter.days).toBe(30);
  });

  it('team filter narrows the on-duty panel (US1-5)', async () => {
    const tech = await getPrisma().user.findUniqueOrThrow({ where: { email: 'a@test.local' } });
    const teamId = await seedTeam([tech.id], { name: 'Filtered Team' });
    const admin = await loginAs('admin@test.local');
    const res = await admin.get(`/api/dashboard/summary?teamId=${teamId}`);
    expect(res.body.teams).toHaveLength(1);
    expect(res.body.teams[0].name).toBe('Filtered Team');
  });
});

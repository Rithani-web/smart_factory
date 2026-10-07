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

describe('US2 public status page API (FR-303…305, FR-311)', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
    await seedUser('Tech A', 'a@test.local', 'TECHNICIAN');
    useFakeMailer();
  });

  afterEach(cleanEvents);

  it('200 WITHOUT authentication; derived Major Outage from an open CRITICAL (US2-1)', async () => {
    const tech = await getPrisma().user.findUniqueOrThrow({ where: { email: 'a@test.local' } });
    await seedTeam([tech.id], { name: 'Line A' });
    const admin = await loginAs('admin@test.local');
    await createEventViaApi(admin, { severity: 'CRITICAL', title: 'Furnace overtemp' });

    const res = await request(app).get('/api/public/status');
    expect(res.status).toBe(200);
    expect(res.body.serverTime).toBeTruthy();
    const lineA = res.body.teams.find((t: { teamName: string }) => t.teamName === 'Line A');
    expect(lineA.derivedStatus).toBe('MAJOR_OUTAGE');
    expect(lineA.finalStatus).toBe('MAJOR_OUTAGE');
    expect(lineA.manualOverride).toBeNull();
    expect(lineA.openCounts.CRITICAL).toBe(1);
  });

  it('LOW open → DEGRADED (US2-2); clean team → OPERATIONAL', async () => {
    const tech = await getPrisma().user.findUniqueOrThrow({ where: { email: 'a@test.local' } });
    await seedTeam([tech.id], { name: 'Line B' });
    const admin = await loginAs('admin@test.local');
    await createEventViaApi(admin, { severity: 'LOW', title: 'Minor oil leak' });

    const res = await request(app).get('/api/public/status');
    const lineB = res.body.teams.find((t: { teamName: string }) => t.teamName === 'Line B');
    expect(lineB.derivedStatus).toBe('DEGRADED');
  });

  it('manual override: admin posts and clears; marked distinctly (US2-3/2-4, FR-305)', async () => {
    const tech = await getPrisma().user.findUniqueOrThrow({ where: { email: 'a@test.local' } });
    const teamId = await seedTeam([tech.id], { name: 'Line C' });
    const admin = await loginAs('admin@test.local');

    const set = await admin
      .put(`/api/teams/${teamId}/status-message`)
      .send({ message: 'Planned maintenance scheduled for Production Line A.' });
    expect(set.status).toBe(200);
    expect(set.body.manualOverride).toMatchObject({
      message: 'Planned maintenance scheduled for Production Line A.',
      authorName: 'Plant Admin',
    });

    const pub = await request(app).get('/api/public/status');
    const row = pub.body.teams.find((t: { teamId: string }) => t.teamId === teamId);
    expect(row.finalStatus).toBe('DEGRADED'); // override visible even when derived is OPERATIONAL
    expect(row.manualOverride).toBeTruthy();
    expect(row.derivedStatus).toBeDefined(); // both surfaces distinguishable

    const clear = await admin.delete(`/api/teams/${teamId}/status-message`);
    expect(clear.status).toBe(204);
    const after = await request(app).get('/api/public/status');
    const rowAfter = after.body.teams.find((t: { teamId: string }) => t.teamId === teamId);
    expect(rowAfter.manualOverride).toBeNull();
  });

  it('data minimality: no emails, no assignee identities anywhere in the payload (FR-311)', async () => {
    const res = await request(app).get('/api/public/status');
    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain('@');
    expect(payload).not.toContain('email');
    expect(payload).not.toContain('assignee');
  });

  it('non-admin cannot set or clear overrides (FR-311)', async () => {
    const teams = await request(app).get('/api/teams');
    expect(teams.status).toBe(401); // /api/teams stays protected; /public/status is the only open route
    const tech = await loginAs('a@test.local');
    const denied = await tech.put(`/api/teams/whatever/status-message`).send({ message: 'x' });
    expect(denied.status).toBe(403);
  });
});

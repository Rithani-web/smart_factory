import { beforeAll, afterEach, describe, expect, it } from 'vitest';

import {
  cleanEvents,
  createEventViaApi,
  loginAs,
  resetDb,
  seedUser,
} from '../helpers.ts';

describe('US2 create production event (FR-004/005/006/015/016)', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
    await seedUser('Duty Tech', 'tech@test.local', 'TECHNICIAN');
    await seedUser('Floor Viewer', 'viewer@test.local', 'VIEWER');
  });

  afterEach(cleanEvents);

  it('ADMIN creates an OPEN event with reporter recorded', async () => {
    const admin = await loginAs('admin@test.local');
    const res = await createEventViaApi(admin);
    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({
      title: 'Packaging line 2 jammer fault',
      severity: 'HIGH',
      status: 'OPEN',
      machineRef: 'Line 2',
      unassigned: true,
    });
    expect(res.body.event.reporter.name).toBe('Plant Admin');
    expect(res.body.event.reporter.email).toBeUndefined(); // FR-018
    expect(res.body.event.history[0].action).toBe('CREATED'); // FR-014
  });

  it('TECHNICIAN can also create (FR-004)', async () => {
    const tech = await loginAs('tech@test.local');
    const res = await createEventViaApi(tech, { title: 'Conveyor motor overheating' });
    expect(res.status).toBe(201);
    expect(res.body.event.reporter.name).toBe('Duty Tech');
  });

  it('400 naming the missing field (FR-004)', async () => {
    const admin = await loginAs('admin@test.local');
    const res = await createEventViaApi(admin, { title: undefined });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('title');
  });

  it('400 for severity outside LOW/MEDIUM/HIGH/CRITICAL (FR-005)', async () => {
    const admin = await loginAs('admin@test.local');
    const res = await createEventViaApi(admin, { severity: 'CATASTROPHIC' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('severity');
  });

  it('403 for VIEWER (FR-016) and list visibility for any role (FR-015)', async () => {
    const viewer = await loginAs('viewer@test.local');
    const denied = await createEventViaApi(viewer);
    expect(denied.status).toBe(403);

    const admin = await loginAs('admin@test.local');
    await createEventViaApi(admin);
    const list = await viewer.get('/api/events');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ status: 'OPEN', severity: 'HIGH' });
  });
});

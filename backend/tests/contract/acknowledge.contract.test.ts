import { beforeAll, afterEach, describe, expect, it } from 'vitest';

import { ERROR_CODES } from '@smart-factory/types';

import { getPrisma } from '../../src/shared/prisma.ts';
import {
  seedTeam,
  cleanEvents,
  createEventViaApi,
  loginAs,
  resetDb,
  seedUser,
  useFakeMailer,
} from '../helpers.ts';

describe('US4 acknowledge (FR-011)', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
    await seedUser('Duty Tech', 'tech@test.local', 'TECHNICIAN');
    await seedUser('Other Tech', 'other@test.local', 'TECHNICIAN');
    await seedUser('Floor Viewer', 'viewer@test.local', 'VIEWER');
    useFakeMailer();
  });

  afterEach(cleanEvents);

  async function assignedEvent() {
    const tech = await getPrisma().user.findUniqueOrThrow({ where: { email: 'tech@test.local' } });
    await seedTeam([tech.id]);
    const admin = await loginAs('admin@test.local');
    const created = await createEventViaApi(admin);
    return created.body.event.id;
  }

  it('assigned technician acknowledges: 200 ACKNOWLEDGED + timestamp + history', async () => {
    const eventId = await assignedEvent();
    const tech = await loginAs('tech@test.local');
    const res = await tech.post(`/api/events/${eventId}/acknowledge`);
    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('ACKNOWLEDGED');
    expect(res.body.event.acknowledgedAt).toBeTruthy();
    const actions = res.body.event.history.map((h: { action: string }) => h.action);
    expect(actions).toEqual(['CREATED', 'ASSIGNED', 'ACKNOWLEDGED']);
  });

  it('403 for a different technician and for VIEWER', async () => {
    const eventId = await assignedEvent();
    const other = await loginAs('other@test.local');
    expect((await other.post(`/api/events/${eventId}/acknowledge`)).status).toBe(403);
    const viewer = await loginAs('viewer@test.local');
    expect((await viewer.post(`/api/events/${eventId}/acknowledge`)).status).toBe(403);
  });

  it('409 NOT_ASSIGNED when acknowledging an OPEN (unassigned) event', async () => {
    const admin = await loginAs('admin@test.local');
    // no roster entry → OPEN
    const created = await createEventViaApi(admin, { title: 'Unassigned event' });
    const res = await admin.post(`/api/events/${created.body.event.id}/acknowledge`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(ERROR_CODES.NOT_ASSIGNED);
  });

  it('409 on double acknowledge (single-status rule, FR-006)', async () => {
    const eventId = await assignedEvent();
    const tech = await loginAs('tech@test.local');
    expect((await tech.post(`/api/events/${eventId}/acknowledge`)).status).toBe(200);
    const again = await tech.post(`/api/events/${eventId}/acknowledge`);
    expect(again.status).toBe(409);
  });
});

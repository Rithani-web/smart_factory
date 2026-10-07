import { beforeAll, afterEach, describe, expect, it } from 'vitest';

import { ERROR_CODES } from '@smart-factory/types';

import { getPrisma } from '../../src/shared/prisma.ts';
import {
  addRosterEntry,
  cleanEvents,
  createEventViaApi,
  loginAs,
  resetDb,
  seedUser,
  useFakeMailer,
} from '../helpers.ts';

describe('US5 resolve (FR-012/013, clarify Q4-A)', () => {
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
    await addRosterEntry(tech.id);
    const admin = await loginAs('admin@test.local');
    const created = await createEventViaApi(admin);
    return created.body.event.id;
  }

  async function acknowledgedEvent() {
    const eventId = await assignedEvent();
    const tech = await loginAs('tech@test.local');
    await tech.post(`/api/events/${eventId}/acknowledge`);
    return eventId;
  }

  it('technician resolves ACKNOWLEDGED event with notes → 200 RESOLVED', async () => {
    const eventId = await acknowledgedEvent();
    const tech = await loginAs('tech@test.local');
    const res = await tech
      .post(`/api/events/${eventId}/resolve`)
      .send({ resolutionNotes: 'Cleared the jam; reset the jammer E-stop.' });
    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('RESOLVED');
    expect(res.body.event.resolutionNotes).toContain('Cleared the jam');
    expect(res.body.event.resolvedAt).toBeTruthy();
    const actions = res.body.event.history.map((h: { action: string }) => h.action);
    expect(actions).toEqual(['CREATED', 'ASSIGNED', 'ACKNOWLEDGED', 'RESOLVED']);
  });

  it('ADMIN may resolve from OPEN/ASSIGNED without acknowledgement', async () => {
    const eventId = await assignedEvent();
    const admin = await loginAs('admin@test.local');
    const res = await admin
      .post(`/api/events/${eventId}/resolve`)
      .send({ resolutionNotes: 'Was a false alarm; sensor recalibrated.' });
    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('RESOLVED');
  });

  it('400 when notes empty/missing (FR-013)', async () => {
    const eventId = await acknowledgedEvent();
    const tech = await loginAs('tech@test.local');
    expect(
      (await tech.post(`/api/events/${eventId}/resolve`).send({ resolutionNotes: '  ' })).status,
    ).toBe(400);
    expect((await tech.post(`/api/events/${eventId}/resolve`).send({})).status).toBe(400);
  });

  it('409 MUST_ACKNOWLEDGE_FIRST: technician resolving an ASSIGNED event', async () => {
    const eventId = await assignedEvent();
    const tech = await loginAs('tech@test.local');
    const res = await tech
      .post(`/api/events/${eventId}/resolve`)
      .send({ resolutionNotes: 'Fixed it already' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(ERROR_CODES.MUST_ACKNOWLEDGE_FIRST);
  });

  it('403 for VIEWER and for a non-assigned technician', async () => {
    const eventId = await acknowledgedEvent();
    const viewer = await loginAs('viewer@test.local');
    expect(
      (await viewer.post(`/api/events/${eventId}/resolve`).send({ resolutionNotes: 'x' })).status,
    ).toBe(403);
    const other = await loginAs('other@test.local');
    expect(
      (await other.post(`/api/events/${eventId}/resolve`).send({ resolutionNotes: 'x' })).status,
    ).toBe(403);
  });
});

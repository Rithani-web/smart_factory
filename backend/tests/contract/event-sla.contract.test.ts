import { beforeAll, afterEach, describe, expect, it } from 'vitest';

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

describe('US2/US3 event SLA payloads (FR-205/206/209)', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
    await seedUser('Duty Tech', 'tech@test.local', 'TECHNICIAN');
    useFakeMailer();
  });

  afterEach(cleanEvents);

  async function criticalEventBackdated(minutesOpen: number) {
    const tech = await getPrisma().user.findUniqueOrThrow({ where: { email: 'tech@test.local' } });
    await seedTeam([tech.id]);
    const admin = await loginAs('admin@test.local');
    const created = await createEventViaApi(admin, { severity: 'CRITICAL' });
    // Back-date creation so the real clock is already past the 5-min target.
    await getPrisma().productionEvent.update({
      where: { id: created.body.event.id },
      data: {
        createdAt: new Date(Date.now() - minutesOpen * 60_000),
      },
    });
    return created.body.event.id;
  }

  it('open CRITICAL event 7 min old: acknowledge SLA BREACHED without ack (FR-206, US2-5)', async () => {
    const eventId = await criticalEventBackdated(7);
    const admin = await loginAs('admin@test.local');
    const res = await admin.get(`/api/events/${eventId}`);
    expect(res.status).toBe(200);
    expect(res.body.sla.acknowledge.status).toBe('BREACHED');
    expect(res.body.sla.acknowledge.targetMinutes).toBe(5);
    expect(res.body.sla.acknowledge.actualMinutes).toBeCloseTo(7, 1);
    expect(res.body.sla.resolve.status).toBe('PENDING'); // 60-min resolve not due yet

    const list = await admin.get('/api/events');
    const row = list.body.find((e: { id: string }) => e.id === eventId);
    expect(row.slaBreached).toBe(true);
  });

  it('acknowledged within target → acknowledge MET with actual (US2-1)', async () => {
    const eventId = await criticalEventBackdated(3);
    await getPrisma().productionEvent.update({
      where: { id: eventId },
      data: { status: 'ASSIGNED', acknowledgedAt: new Date() },
    });
    const admin = await loginAs('admin@test.local');
    const res = await admin.get(`/api/events/${eventId}`);
    expect(res.body.sla.acknowledge.status).toBe('MET');
    expect(res.body.sla.acknowledge.actualMinutes).toBeCloseTo(3, 1);
    expect(res.body.sla.resolve.status).toBe('PENDING');
  });

  it('every detail contains both SLA dimensions (FR-205)', async () => {
    const eventId = await criticalEventBackdated(1);
    const admin = await loginAs('admin@test.local');
    const res = await admin.get(`/api/events/${eventId}`);
    expect(res.body.sla.acknowledge).toHaveProperty('status');
    expect(res.body.sla.resolve).toHaveProperty('status');
    expect(['MET', 'BREACHED', 'PENDING']).toContain(res.body.sla.acknowledge.status);
    expect(['MET', 'BREACHED', 'PENDING']).toContain(res.body.sla.resolve.status);
  });
});

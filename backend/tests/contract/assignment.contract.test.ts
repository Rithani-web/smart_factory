import { beforeAll, afterEach, describe, expect, it } from 'vitest';

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

describe('US3 auto-assignment & notification (FR-007/008/009/017)', () => {
  const sends = useFakeMailer();

  beforeAll(async () => {
    await resetDb();
    await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
    await seedUser('Duty Tech', 'tech@test.local', 'TECHNICIAN');
    await seedUser('Night Tech', 'night@test.local', 'TECHNICIAN');
    await seedUser('Floor Viewer', 'viewer@test.local', 'VIEWER');
  });

  afterEach(async () => {
    sends.length = 0;
    await cleanEvents();
  });

  it('assigns to the on-duty technician, records ASSIGNED, sends one email', async () => {
    const tech = await getPrisma().user.findUniqueOrThrow({ where: { email: 'tech@test.local' } });
    await addRosterEntry(tech.id);

    const admin = await loginAs('admin@test.local');
    const res = await createEventViaApi(admin);
    expect(res.status).toBe(201);
    expect(res.body.unassigned).toBe(false);
    expect(res.body.event.status).toBe('ASSIGNED');
    expect(res.body.event.assignee).toMatchObject({ name: 'Duty Tech', role: 'TECHNICIAN' });
    expect(res.body.event.assignee.email).toBeUndefined(); // FR-018

    const actions = res.body.event.history.map((h: { action: string }) => h.action);
    expect(actions).toEqual(['CREATED', 'ASSIGNED']); // FR-014 chronological

    expect(sends).toHaveLength(1);
    expect(sends[0].to).toBe('tech@test.local');
    expect(sends[0].subject).toContain('HIGH');
    expect(sends[0].html).toContain('Packaging line 2 jammer fault');
    expect(sends[0].html).toContain('Line 2');

    const db = getPrisma();
    const assignment = await db.assignment.findFirstOrThrow({ where: { active: true } });
    expect(assignment.technicianId).toBe(tech.id);
    expect((await db.notification.findMany()).length).toBe(1);
  });

  it('leaves the event OPEN + unassigned when nobody is on duty (FR-008)', async () => {
    const admin = await loginAs('admin@test.local');
    const res = await createEventViaApi(admin, { title: 'No duty tech around' });
    expect(res.status).toBe(201);
    expect(res.body.unassigned).toBe(true);
    expect(res.body.event.status).toBe('OPEN');
    expect(res.body.event.assignee).toBeNull();
    expect(sends).toHaveLength(0); // no notification without assignment
  });

  it('ADMIN reassign: prior assignment deactivated, REASSIGNED history, re-notified', async () => {
    const tech = await getPrisma().user.findUniqueOrThrow({ where: { email: 'tech@test.local' } });
    const night = await getPrisma().user.findUniqueOrThrow({ where: { email: 'night@test.local' } });
    await addRosterEntry(tech.id);

    const admin = await loginAs('admin@test.local');
    const created = await createEventViaApi(admin);
    const eventId = created.body.event.id;

    const res = await admin.post(`/api/events/${eventId}/reassign`).send({ technicianId: night.id });
    expect(res.status).toBe(200);
    expect(res.body.event.assignee).toMatchObject({ name: 'Night Tech' });

    const db = getPrisma();
    const assignments = await db.assignment.findMany({ where: { eventId } });
    expect(assignments.filter((a) => a.active)).toHaveLength(1);
    expect(assignments.find((a) => a.active)?.technicianId).toBe(night.id);

    const actions = res.body.event.history.map((h: { action: string }) => h.action);
    expect(actions).toContain('REASSIGNED');
    expect(sends.filter((s) => s.to === 'night@test.local')).toHaveLength(1);
    expect((await db.notification.findMany()).length).toBe(2);
  });

  it('reassign denied for TECHNICIAN/VIEWER, 404 for unknown technician (FR-016)', async () => {
    const tech = await getPrisma().user.findUniqueOrThrow({ where: { email: 'tech@test.local' } });
    await addRosterEntry(tech.id);
    const admin = await loginAs('admin@test.local');
    const created = await createEventViaApi(admin);
    const eventId = created.body.event.id;

    const techAgent = await loginAs('tech@test.local');
    expect(
      (await techAgent.post(`/api/events/${eventId}/reassign`).send({ technicianId: tech.id }))
        .status,
    ).toBe(403);

    const viewer = await loginAs('viewer@test.local');
    expect(
      (await viewer.post(`/api/events/${eventId}/reassign`).send({ technicianId: tech.id }))
        .status,
    ).toBe(403);

    const missing = await admin
      .post(`/api/events/${eventId}/reassign`)
      .send({ technicianId: 'nope' });
    expect(missing.status).toBe(404);
  });
});

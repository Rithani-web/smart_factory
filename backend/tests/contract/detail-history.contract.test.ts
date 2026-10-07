import { beforeAll, afterEach, describe, expect, it } from 'vitest';

import {
  seedTeam,
  cleanEvents,
  createEventViaApi,
  loginAs,
  resetDb,
  seedUser,
  useFakeMailer,
} from '../helpers.ts';

describe('US6 detail & lifecycle history (FR-014/015)', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
    await seedUser('Duty Tech', 'tech@test.local', 'TECHNICIAN');
    await seedUser('Floor Viewer', 'viewer@test.local', 'VIEWER');
    useFakeMailer();
  });

  afterEach(cleanEvents);

  it('full chronological trail with actor {id,name,role}; VIEWER can view; 404 unknown', async () => {
    const tech = await (await import('../../src/shared/prisma.ts')).getPrisma().user.findUniqueOrThrow({
      where: { email: 'tech@test.local' },
    });
    await seedTeam([tech.id]);

    const admin = await loginAs('admin@test.local');
    const created = await createEventViaApi(admin);
    const eventId = created.body.event.id;

    const techAgent = await loginAs('tech@test.local');
    await techAgent.post(`/api/events/${eventId}/acknowledge`);
    await techAgent
      .post(`/api/events/${eventId}/resolve`)
      .send({ resolutionNotes: 'Replaced the jammer drive belt.' });

    // VIEWER sees full detail incl. history (FR-015) — with no emails (FR-018).
    const viewer = await loginAs('viewer@test.local');
    const res = await viewer.get(`/api/events/${eventId}`);
    expect(res.status).toBe(200);
    const actions = res.body.history.map((h: { action: string }) => h.action);
    expect(actions).toEqual(['CREATED', 'ASSIGNED', 'ACKNOWLEDGED', 'RESOLVED']);
    for (const h of res.body.history) {
      expect(Object.keys(h.actor).sort()).toEqual(['id', 'name', 'role']);
    }
    expect(JSON.stringify(res.body)).not.toContain('@test.local');

    const missing = await viewer.get('/api/events/does-not-exist');
    expect(missing.status).toBe(404);
  });
});

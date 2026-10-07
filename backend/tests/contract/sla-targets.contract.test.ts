import { beforeAll, describe, expect, it } from 'vitest';

import {
  loginAs,
  resetDb,
  seedUser,
} from '../helpers.ts';

describe('US1 SLA targets API (FR-201/202/210)', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
    await seedUser('Duty Tech', 'tech@test.local', 'TECHNICIAN');
    await seedUser('Floor Viewer', 'viewer@test.local', 'VIEWER');
  });

  it('defaults visible to every role without configuration (FR-202, US1-1)', async () => {
    for (const email of ['admin@test.local', 'tech@test.local', 'viewer@test.local']) {
      const agent = await loginAs(email);
      const res = await agent.get('/api/sla-targets');
      expect(res.status).toBe(200);
      const bySeverity = Object.fromEntries(
        res.body.targets.map((t: { severity: string }) => [t.severity, t]),
      );
      expect(bySeverity.CRITICAL).toEqual({ severity: 'CRITICAL', ackMinutes: 5, resolveMinutes: 60 });
      expect(bySeverity.LOW).toEqual({ severity: 'LOW', ackMinutes: 240, resolveMinutes: 1440 });
    }
  });

  it('writes ADMIN-only, server-side (FR-210, US1-3)', async () => {
    const body = { targets: { CRITICAL: { ackMinutes: 4, resolveMinutes: 45 } } };
    for (const email of ['viewer@test.local', 'tech@test.local']) {
      const agent = await loginAs(email);
      expect((await agent.put('/api/sla-targets').send(body)).status).toBe(403);
    }
  });

  it('ADMIN updates targets; every role sees the change (FR-201, US1-2)', async () => {
    const admin = await loginAs('admin@test.local');
    const res = await admin
      .put('/api/sla-targets')
      .send({ targets: { CRITICAL: { ackMinutes: 4, resolveMinutes: 45 } } });
    expect(res.status).toBe(200);
    const critical = res.body.targets.find((t: { severity: string }) => t.severity === 'CRITICAL');
    expect(critical).toEqual({ severity: 'CRITICAL', ackMinutes: 4, resolveMinutes: 45 });

    const viewer = await loginAs('viewer@test.local');
    const seen = await viewer.get('/api/sla-targets');
    expect(seen.body.targets.find((t: { severity: string }) => t.severity === 'CRITICAL').ackMinutes).toBe(4);

    // validation: <1 rejected
    const bad = await admin
      .put('/api/sla-targets')
      .send({ targets: { HIGH: { ackMinutes: 0, resolveMinutes: 10 } } });
    expect(bad.status).toBe(400);

    // restore defaults for other suites
    await admin
      .put('/api/sla-targets')
      .send({ targets: { CRITICAL: { ackMinutes: 5, resolveMinutes: 60 } } });
  });
});

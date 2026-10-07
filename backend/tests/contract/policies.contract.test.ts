import { beforeAll, afterEach, describe, expect, it } from 'vitest';

import {
  cleanEvents,
  loginAs,
  resetDb,
  seedUser,
} from '../helpers.ts';

describe('US3 escalation policies API (FR-106/114)', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
    await seedUser('Duty Tech', 'tech@test.local', 'TECHNICIAN');
    await seedUser('Floor Viewer', 'viewer@test.local', 'VIEWER');
  });

  it('defaults are seeded-visible: CRITICAL 5, HIGH 15, MEDIUM 60, LOW null (FR-106)', async () => {
    const viewer = await loginAs('viewer@test.local');
    const res = await viewer.get('/api/escalation-policies');
    expect(res.status).toBe(200);
    const bySeverity = Object.fromEntries(
      res.body.policies.map((p: { severity: string; windowMinutes: number | null }) => [
        p.severity,
        p.windowMinutes,
      ]),
    );
    expect(bySeverity).toEqual({ CRITICAL: 5, HIGH: 15, MEDIUM: 60, LOW: null });
  });

  it('writes ADMIN-only, server-side (US3-3)', async () => {
    const viewer = await loginAs('viewer@test.local');
    const tech = await loginAs('tech@test.local');
    for (const agent of [viewer, tech]) {
      const res = await agent
        .put('/api/escalation-policies')
        .send({ windows: { CRITICAL: 10 } });
      expect(res.status).toBe(403);
    }
  });

  it('ADMIN updates a window; change visible to every role (US3-1/3-2)', async () => {
    const admin = await loginAs('admin@test.local');
    const res = await admin
      .put('/api/escalation-policies')
      .send({ windows: { CRITICAL: 10 } });
    expect(res.status).toBe(200);
    expect(res.body.policies.find((p: { severity: string }) => p.severity === 'CRITICAL').windowMinutes).toBe(10);

    const viewer = await loginAs('viewer@test.local');
    const seen = await viewer.get('/api/escalation-policies');
    expect(seen.body.policies.find((p: { severity: string }) => p.severity === 'CRITICAL').windowMinutes).toBe(10);

    // restore default for other suites
    await admin.put('/api/escalation-policies').send({ windows: { CRITICAL: 5 } });

    // validation: zero/negative minutes rejected
    const bad = await admin.put('/api/escalation-policies').send({ windows: { HIGH: 0 } });
    expect(bad.status).toBe(400);
  });

  afterEach(cleanEvents);
});

import { beforeAll, afterEach, describe, expect, it } from 'vitest';

import { getPrisma } from '../../src/shared/prisma.ts';
import { runEscalationTick } from '../../src/escalation/evaluator.ts';
import { createEvent } from '../../src/events/service.ts';
import {
  cleanEvents,
  resetDb,
  seedTeam,
  seedUser,
  useFakeMailer,
} from '../helpers.ts';

// Injected clock baseline (FR-113): all timing is synthetic — ZERO sleeps.
const BASE = new Date('2026-10-07T10:00:00Z');
const min = (n: number) => new Date(BASE.getTime() + n * 60_000);

describe('US2 escalation engine (FR-108…112) — mocked time only', () => {
  let admin: { id: string; name: string; role: 'ADMIN' };
  let a: { id: string };
  let b: { id: string };
  let c: { id: string };

  beforeAll(async () => {
    await resetDb();
    const adminUser = await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
    admin = { id: adminUser.id, name: 'Plant Admin', role: 'ADMIN' };
    a = await seedUser('Tech A', 'a@test.local', 'TECHNICIAN');
    b = await seedUser('Tech B', 'b@test.local', 'TECHNICIAN');
    c = await seedUser('Tech C', 'c@test.local', 'TECHNICIAN');
    useFakeMailer();
  });

  afterEach(cleanEvents);

  /** CRITICAL event assigned to A (rotation position 0), deadline = BASE+5min. */
  async function criticalEventWithTeam(memberIds: string[] = [a.id, b.id, c.id]) {
    await seedTeam(memberIds, { escalationAdminId: admin.id, anchorOffsetMs: 60 * 60 * 1000 });
    const { event } = await createEvent(admin, {
      title: 'Furnace overtemperature',
      description: 'Zone 3 over limit',
      machineRef: 'Furnace 1',
      severity: 'CRITICAL',
    });
    // Pin the deadline to synthetic time (createEvent used the real clock).
    await getPrisma().productionEvent.update({
      where: { id: event.id },
      data: { ackDeadline: min(5) },
    });
    return event.id;
  }

  it('escalates A → B once the 5-minute window passes (US2-1)', async () => {
    const eventId = await criticalEventWithTeam();
    const outcomes = await runEscalationTick(min(6));
    expect(outcomes).toEqual([
      { eventId, from: 'Tech A', to: 'Tech B', terminal: false },
    ]);
    const db = getPrisma();
    const event = await db.productionEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.status).toBe('ASSIGNED');
    expect(event.escalationStep).toBe(1);
    expect(event.ackDeadline!.getTime()).toBe(min(11).getTime()); // 6min tick + 5min window

    const active = await db.assignment.findFirstOrThrow({ where: { eventId, active: true } });
    expect(active.technicianId).toBe(b.id);

    const escalated = await db.historyEntry.findFirstOrThrow({
      where: { eventId, action: 'ESCALATED' },
    });
    expect(escalated.detail).toBe('Tech A → Tech B (CRITICAL unacknowledged 5m)');
    expect((await db.notification.findMany({ where: { eventId } })).length).toBeGreaterThan(0);
  });

  it('walks the full rotation then terminates at the designated admin (US2-2, FR-109)', async () => {
    const eventId = await criticalEventWithTeam();
    await runEscalationTick(min(6)); // A → B
    await runEscalationTick(min(12)); // B → C
    const outcomes = await runEscalationTick(min(18)); // C → admin (terminal)
    expect(outcomes).toEqual([
      { eventId, from: 'Tech C', to: 'Plant Admin', terminal: true },
    ]);
    const event = await getPrisma().productionEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.ackDeadline).toBeNull(); // terminal
    const active = await getPrisma().assignment.findFirstOrThrow({
      where: { eventId, active: true },
    });
    expect(active.technicianId).toBe(admin.id);
    expect(
      (await getPrisma().historyEntry.findMany({ where: { eventId, action: 'ESCALATED' } }))
        .map((h) => h.detail),
    ).toEqual([
      'Tech A → Tech B (CRITICAL unacknowledged 5m)',
      'Tech B → Tech C (CRITICAL unacknowledged 5m)',
      'Tech C → Plant Admin (CRITICAL unacknowledged 5m)',
    ]);
  });

  it('is idempotent: repeated ticks at the same deadline escalate once (FR-111)', async () => {
    const eventId = await criticalEventWithTeam();
    await runEscalationTick(min(6));
    await runEscalationTick(min(6.5)); // still before the recomputed deadline
    const count = await getPrisma().historyEntry.count({
      where: { eventId, action: 'ESCALATED' },
    });
    expect(count).toBe(1);
  });

  it('never escalates acknowledged, resolved, or window-less events (US2-3/4/5, FR-112)', async () => {
    const ackedId = await criticalEventWithTeam();
    await getPrisma().productionEvent.update({
      where: { id: ackedId },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: min(2), ackDeadline: null },
    });

    const resolvedId = await criticalEventWithTeam();
    await getPrisma().productionEvent.update({
      where: { id: resolvedId },
      data: { status: 'RESOLVED', ackDeadline: null },
    });

    const lowId = await criticalEventWithTeam();
    await getPrisma().productionEvent.update({
      where: { id: lowId },
      data: { severity: 'LOW', ackDeadline: null },
    });

    const outcomes = await runEscalationTick(min(30));
    expect(outcomes).toEqual([]);
  });

  it('single-member rotation goes straight to the designated admin (edge case)', async () => {
    const eventId = await criticalEventWithTeam([a.id]);
    const outcomes = await runEscalationTick(min(6));
    expect(outcomes).toEqual([{ eventId, from: 'Tech A', to: 'Plant Admin', terminal: true }]);
  });

  it('skips a member removed from the rotation (edge case)', async () => {
    const eventId = await criticalEventWithTeam([a.id, b.id]);
    // Remove B (position 1) — rotation now holds only A, already assigned.
    await getPrisma().teamMembership.deleteMany();
    await getPrisma().teamMembership.create({
      data: { teamId: (await getPrisma().team.findFirstOrThrow()).id, technicianId: a.id, position: 0 },
    });
    const outcomes = await runEscalationTick(min(6));
    expect(outcomes).toEqual([{ eventId, from: 'Tech A', to: 'Plant Admin', terminal: true }]);
  });
});

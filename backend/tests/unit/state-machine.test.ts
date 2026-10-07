import { beforeAll, afterEach, describe, expect, it } from 'vitest';

import { ERROR_CODES } from '@smart-factory/types';

import { acknowledge, createEvent, resolve } from '../../src/events/service.ts';
import { getPrisma } from '../../src/shared/prisma.ts';
import { HttpError } from '../../src/shared/errors.ts';
import {
  cleanEvents,
  resetDb,
  seedTeam,
  seedUser,
  useFakeMailer,
} from '../helpers.ts';

type EventStatus = 'OPEN' | 'ASSIGNED' | 'ACKNOWLEDGED' | 'RESOLVED';

/**
 * Exhaustive transition×role matrix (FR-309, research D24). Every cell asserts
 * the exact outcome through the events service — success + history, or the
 * precise HttpError status/code.
 */
describe('state-machine exhaustive matrix (FR-309)', () => {
  let admin: { id: string; name: string; role: 'ADMIN' };
  let techA: { id: string; name: string; role: 'TECHNICIAN' };
  let techB: { id: string; name: string; role: 'TECHNICIAN' };
  let viewer: { id: string; name: string; role: 'VIEWER' };

  beforeAll(async () => {
    await resetDb();
    const a = await seedUser('Plant Admin', 'admin@test.local', 'ADMIN');
    admin = { id: a.id, name: 'Plant Admin', role: 'ADMIN' };
    const ua = await seedUser('Tech A', 'a@test.local', 'TECHNICIAN');
    techA = { id: ua.id, name: 'Tech A', role: 'TECHNICIAN' };
    const ub = await seedUser('Tech B', 'b@test.local', 'TECHNICIAN');
    techB = { id: ub.id, name: 'Tech B', role: 'TECHNICIAN' };
    const uv = await seedUser('Floor Viewer', 'viewer@test.local', 'VIEWER');
    viewer = { id: uv.id, name: 'Floor Viewer', role: 'VIEWER' };
    useFakeMailer();
  });

  afterEach(cleanEvents);

  async function eventIn(status: EventStatus): Promise<string> {
    await seedTeam([techA.id]);
    const { event } = await createEvent(techA, {
      title: `Event ${status}`,
      description: 'matrix',
      machineRef: 'Line 1',
      severity: 'HIGH',
    });
    const db = getPrisma();
    const patch: Record<string, unknown> = { status, ackDeadline: null };
    if (status === 'ACKNOWLEDGED') {
      patch.acknowledgedAt = new Date();
    }
    if (status === 'RESOLVED') {
      patch.acknowledgedAt = new Date();
      patch.resolvedAt = new Date();
      patch.resolvedById = techA.id;
      patch.resolutionNotes = 'done';
    }
    await db.productionEvent.update({ where: { id: event.id }, data: patch });
    return event.id;
  }

  async function expectOutcome(
    p: Promise<unknown>,
    expect_: { status: number; code?: string },
  ): Promise<void> {
    try {
      await p;
      expect(expect_.status).toBeLessThan(300);
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const e = err as HttpError;
      expect(e.status).toBe(expect_.status);
      if (expect_.code) {
        expect(e.code).toBe(expect_.code);
      }
    }
  }

  // ── ACKNOWLEDGE ────────────────────────────────────────────────────────────
  it('ACKNOWLEDGE from OPEN → 409 for everyone (status gate first, FR-011)', async () => {
    const id = await eventIn('OPEN');
    for (const actor of [admin, techA, techB, viewer]) {
      await expectOutcome(acknowledge(actor, id), {
        status: 409,
        code: ERROR_CODES.NOT_ASSIGNED,
      });
    }
  });

  it('ACKNOWLEDGE from ASSIGNED → assignee 200 / admin 200 / other-tech 403 / viewer 403', async () => {
    const id = await eventIn('ASSIGNED');
    await expectOutcome(acknowledge(techA, id), { status: 200 });
  });

  it('ACKNOWLEDGE from ASSIGNED: other technician and viewer rejected 403 (FR-011)', async () => {
    const id1 = await eventIn('ASSIGNED');
    await expectOutcome(acknowledge(techB, id1), { status: 403 });
    const id2 = await eventIn('ASSIGNED');
    await expectOutcome(acknowledge(viewer, id2), { status: 403 });
    const id3 = await eventIn('ASSIGNED');
    await expectOutcome(acknowledge(admin, id3), { status: 200 }); // admin exempt
  });

  it('ACKNOWLEDGE from ACKNOWLEDGED/RESOLVED → 409 (single-status rule, FR-006)', async () => {
    const id1 = await eventIn('ACKNOWLEDGED');
    await expectOutcome(acknowledge(techA, id1), { status: 409, code: ERROR_CODES.NOT_ASSIGNED });
    const id2 = await eventIn('RESOLVED');
    await expectOutcome(acknowledge(admin, id2), { status: 409, code: ERROR_CODES.NOT_ASSIGNED });
  });

  // ── RESOLVE ────────────────────────────────────────────────────────────────
  it('RESOLVE from OPEN → admin 200; assigned tech 409 MUST_ACK; viewer 403 (FR-012)', async () => {
    const id1 = await eventIn('OPEN');
    await expectOutcome(resolve(admin, id1, 'notes'), { status: 200 });
    const id2 = await eventIn('OPEN');
    await expectOutcome(resolve(techA, id2, 'notes'), {
      status: 409,
      code: ERROR_CODES.MUST_ACKNOWLEDGE_FIRST,
    });
    const id3 = await eventIn('OPEN');
    await expectOutcome(resolve(viewer, id3, 'notes'), { status: 403 });
  });

  it('RESOLVE from ASSIGNED → admin 200; assigned tech 409 MUST_ACK; other tech 403', async () => {
    const id1 = await eventIn('ASSIGNED');
    await expectOutcome(resolve(admin, id1, 'notes'), { status: 200 });
    const id2 = await eventIn('ASSIGNED');
    await expectOutcome(resolve(techA, id2, 'notes'), {
      status: 409,
      code: ERROR_CODES.MUST_ACKNOWLEDGE_FIRST,
    });
    const id3 = await eventIn('ASSIGNED');
    await expectOutcome(resolve(techB, id3, 'notes'), { status: 403 });
  });

  it('RESOLVE from ACKNOWLEDGED → assignee 200 / admin 200 / other tech 403 / viewer 403', async () => {
    const id1 = await eventIn('ACKNOWLEDGED');
    await expectOutcome(resolve(techA, id1, 'notes'), { status: 200 });
    const id2 = await eventIn('ACKNOWLEDGED');
    await expectOutcome(resolve(admin, id2, 'notes'), { status: 200 });
    const id3 = await eventIn('ACKNOWLEDGED');
    await expectOutcome(resolve(techB, id3, 'notes'), { status: 403 });
    const id4 = await eventIn('ACKNOWLEDGED');
    await expectOutcome(resolve(viewer, id4, 'notes'), { status: 403 });
  });

  it('RESOLVE from RESOLVED → 409 for everyone (idempotent closure)', async () => {
    const id = await eventIn('RESOLVED');
    for (const actor of [admin, techA, viewer]) {
      await expectOutcome(resolve(actor, id, 'notes'), {
        status: 409,
        code: ERROR_CODES.NOT_ASSIGNED,
      });
    }
  });

  it('every successful transition appends exactly one history entry (FR-014)', async () => {
    const id = await eventIn('ASSIGNED');
    const before = await getPrisma().historyEntry.count({ where: { eventId: id } });
    await acknowledge(techA, id);
    const after = await getPrisma().historyEntry.count({ where: { eventId: id } });
    expect(after).toBe(before + 1);
  });
});

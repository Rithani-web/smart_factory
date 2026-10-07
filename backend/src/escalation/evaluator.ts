import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

import { getPrisma } from '../shared/prisma.ts';
import { recordAndSend } from '../notifications/service.ts';
import { firstTeamRotation } from '../teams/service.ts';
import { windowFor } from './policies.ts';

export interface EscalationOutcome {
  eventId: string;
  from: string;
  to: string;
  terminal: boolean;
}

const SYSTEM_EMAIL = 'system@factory.internal';

/** ESCALATED history entries are authored by the system itself — represented
 * by a dedicated account, created lazily. */
async function systemActorId(db: PrismaClient): Promise<string> {
  const existing = await db.user.findUnique({ where: { email: SYSTEM_EMAIL }, select: { id: true } });
  if (existing) {
    return existing.id;
  }
  const passwordHash = await bcrypt.hash(randomUUID(), 4);
  const created = await db.user.create({
    data: {
      name: 'System',
      email: SYSTEM_EMAIL,
      role: 'ADMIN',
      passwordHash,
      mustChangePassword: false,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Escalation evaluator (FR-108…112, research D13/D15). Injectable clock:
 * pass `now` in tests (FR-113 — no sleeps); production calls it without
 * arguments from a 30 s interval in server.ts. Each deadline escalates at
 * most once because the deadline is recomputed into the future (or nulled
 * at the terminal step).
 */
export async function runEscalationTick(
  now: Date = new Date(),
  db: PrismaClient = getPrisma(),
): Promise<EscalationOutcome[]> {
  const due = await db.productionEvent.findMany({
    where: { status: 'ASSIGNED', ackDeadline: { lt: now } },
    include: {
      assignments: {
        where: { active: true },
        include: { technician: { select: { id: true, name: true, role: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const outcomes: EscalationOutcome[] = [];
  const systemId = due.length > 0 ? await systemActorId(db) : null;

  for (const event of due) {
    const assignee = event.assignments[0]?.technician;
    if (!assignee || !systemId) {
      continue;
    }
    const rotation = await firstTeamRotation(now, db);
    const windowMinutes = await windowFor(event.severity, db);

    // Escalation order: the rotation position AFTER the current assignee;
    // past the end of the rotation → designated admin (research D15, US2-2).
    // escalationStep is bookkeeping (hop count), selection uses the assignee's
    // own position — each escalation reassigns, so "next" advances by one.
    const members = rotation?.members ?? [];
    const pos = members.findIndex((m) => m.id === assignee.id);
    const nextIndex = (pos === -1 ? 0 : pos) + 1;
    const next = nextIndex < members.length ? members[nextIndex] : null;
    let terminal = false;

    let targetId: string;
    let targetName: string;
    if (next) {
      targetId = next.id;
      targetName = next.name;
    } else {
      // Rotation exhausted → designated admin, terminal (FR-109, clarified Q4).
      const adminId =
        rotation?.team.escalationAdminId ??
        (
          await db.user.findFirst({
            where: { role: 'ADMIN' },
            orderBy: { id: 'asc' },
            select: { id: true },
          })
        )?.id;
      if (!adminId || adminId === assignee.id) {
        // No admin to escalate to other than the assignee — leave untouched.
        continue;
      }
      const admin = await db.user.findUniqueOrThrow({
        where: { id: adminId },
        select: { id: true, name: true, email: true },
      });
      targetId = admin.id;
      targetName = admin.name;
      terminal = true;
    }

    const targetUser = await db.user.findUniqueOrThrow({
      where: { id: targetId },
      select: { id: true, name: true, email: true },
    });

    const detail = `${assignee.name} → ${targetName} (${event.severity} unacknowledged ${windowMinutes ?? 0}m)`;

    await db.$transaction(async (tx) => {
      await tx.assignment.updateMany({
        where: { eventId: event.id, active: true },
        data: { active: false },
      });
      await tx.assignment.create({
        data: { eventId: event.id, technicianId: targetUser.id, active: true },
      });
      await tx.historyEntry.create({
        data: { eventId: event.id, action: 'ESCALATED', actorId: systemId, detail },
      });
    });

    // Notify the new assignee; attempt always recorded (FR-110).
    await recordAndSend(event, {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
    });

    await db.productionEvent.update({
      where: { id: event.id },
      data: terminal
        ? { ackDeadline: null, escalationStep: event.escalationStep + 1 }
        : {
            ackDeadline: new Date(now.getTime() + (windowMinutes ?? 60) * 60_000),
            escalationStep: event.escalationStep + 1,
          },
    });

    outcomes.push({ eventId: event.id, from: assignee.name, to: targetName, terminal });
  }
  return outcomes;
}

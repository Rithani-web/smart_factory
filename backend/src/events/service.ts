import {
  ERROR_CODES,
  type EventDetailDTO,
  type EventDTO,
  type Severity,
  type UserDTO,
} from '@smart-factory/types';
import type { HistoryAction, Prisma } from '@prisma/client';

import {
  badRequest,
  conflict,
  forbidden,
  httpError,
  notFound,
} from '../shared/errors.ts';
import { getPrisma } from '../shared/prisma.ts';
import { recordAndSend } from '../notifications/service.ts';
import { firstTeamRotation } from '../teams/service.ts';
import { windowFor } from '../escalation/policies.ts';
import { evaluateSla, type SlaTargets } from '../sla/engine.ts';
import { slaTargetsMap } from '../sla/service.ts';
import { SEVERITIES } from '@smart-factory/types';

const ACTIVE_STATUSES = ['OPEN', 'ASSIGNED', 'ACKNOWLEDGED'] as const;

const detailInclude = {
  reporter: { select: { id: true, name: true, role: true } },
  resolvedBy: { select: { id: true, name: true, role: true } },
  assignments: {
    where: { active: true },
    include: { technician: { select: { id: true, name: true, role: true } } },
  },
  history: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { id: true, name: true, role: true } } },
  },
} satisfies Prisma.ProductionEventInclude;

type EventWithRelations = Prisma.ProductionEventGetPayload<{ include: typeof detailInclude }>;

type Actor = { id: string; name: string; role: string };

export async function createEvent(
  actor: Actor,
  input: {
    title?: string;
    description?: string;
    machineRef?: string;
    severity?: Severity;
  },
): Promise<{ event: EventDetailDTO; unassigned: boolean }> {
  const { title, description, machineRef, severity } = input;
  if (!title || !description || !machineRef) {
    throw badRequest('title, description and machineRef are required');
  }
  if (!severity || !SEVERITIES.includes(severity)) {
    throw badRequest('severity must be one of LOW, MEDIUM, HIGH, CRITICAL');
  }

  const db = getPrisma();
  const now = new Date();
  const id = await db.$transaction(async (tx) => {
    const event = await tx.productionEvent.create({
      data: {
        title,
        description,
        machineRef,
        severity,
        status: 'OPEN',
        reporterId: actor.id,
      },
    });
    await tx.historyEntry.create({
      data: { eventId: event.id, action: 'CREATED', actorId: actor.id },
    });

    // Assignment: current rotation position of the first team (spec/002 FR-105,
    // replacing the spec/001 window roster — research D14).
    const rotation = await firstTeamRotation(now, tx);
    if (!rotation) {
      return { eventId: event.id, unassigned: true as const, technicianId: null };
    }
    const onDuty = rotation.members[rotation.onDutyIndex];
    await tx.assignment.create({
      data: { eventId: event.id, technicianId: onDuty.id, active: true },
    });
    // Acknowledgement deadline from the severity policy (FR-106/107).
    const windowMinutes = await windowFor(severity, tx as ReturnType<typeof getPrisma>);
    await tx.productionEvent.update({
      where: { id: event.id },
      data: {
        status: 'ASSIGNED',
        escalationStep: 0,
        ackDeadline:
          windowMinutes != null ? new Date(now.getTime() + windowMinutes * 60_000) : null,
      },
    });
    await tx.historyEntry.create({
      data: {
        eventId: event.id,
        action: 'ASSIGNED',
        actorId: actor.id,
        detail: onDuty.name,
      },
    });
    return {
      eventId: event.id,
      unassigned: false as const,
      technicianId: onDuty.id,
      technicianName: onDuty.name,
    };
  });

  // Notification outside the transaction; failure recorded, never fatal (FR-010).
  if (!id.unassigned) {
    const full = await db.productionEvent.findUniqueOrThrow({ where: { id: id.eventId } });
    const email = await db.user.findUniqueOrThrow({
      where: { id: id.technicianId! },
      select: { id: true, email: true, name: true },
    });
    await recordAndSend(full, email);
  }

  const event = await getEventDetail(id.eventId);
  return { event, unassigned: id.unassigned };
}

export async function listEvents(): Promise<EventDTO[]> {
  const db = getPrisma();
  const [events, targets] = await Promise.all([
    db.productionEvent.findMany({
      orderBy: { createdAt: 'desc' },
      include: { assignments: { where: { active: true }, select: { id: true } } },
    }),
    slaTargetsMap(db),
  ]);
  const now = new Date();
  return events.map((e) => {
    const sla = evaluateSla(e, targets[e.severity], now);
    return {
      id: e.id,
      title: e.title,
      severity: e.severity,
      status: e.status,
      machineRef: e.machineRef,
      createdAt: e.createdAt.toISOString(),
      unassigned: e.assignments.length === 0,
      slaBreached: sla.acknowledge.status === 'BREACHED' || sla.resolve.status === 'BREACHED',
    };
  });
}

export async function getEventDetail(id: string): Promise<EventDetailDTO> {
  const db = getPrisma();
  const [event, targets] = await Promise.all([
    db.productionEvent.findUnique({ where: { id }, include: detailInclude }),
    slaTargetsMap(db),
  ]);
  if (!event) {
    throw notFound('Production event not found');
  }
  return toDetailDTO(event, targets);
}

export async function acknowledge(actor: Actor, eventId: string): Promise<EventDetailDTO> {
  const db = getPrisma();
  const event = await requireEvent(db, eventId);
  if (event.status !== 'ASSIGNED') {
    throw conflict(ERROR_CODES.NOT_ASSIGNED, 'Only ASSIGNED events can be acknowledged');
  }
  const assignee = event.assignments[0]?.technician;
  if (actor.role !== 'ADMIN' && actor.id !== assignee?.id) {
    throw forbidden('Only the assigned technician or an Admin can acknowledge');
  }
  await db.$transaction([
    db.productionEvent.update({
      where: { id: eventId },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), ackDeadline: null },
    }),
    db.historyEntry.create({
      data: { eventId, action: 'ACKNOWLEDGED', actorId: actor.id },
    }),
  ]);
  return getEventDetail(eventId);
}

export async function resolve(
  actor: Actor,
  eventId: string,
  resolutionNotes: string,
): Promise<EventDetailDTO> {
  if (!resolutionNotes || !resolutionNotes.trim()) {
    throw badRequest('Resolution notes are required');
  }
  const db = getPrisma();
  const event = await requireEvent(db, eventId);
  if (!ACTIVE_STATUSES.includes(event.status as (typeof ACTIVE_STATUSES)[number])) {
    throw conflict(ERROR_CODES.NOT_ASSIGNED, 'This event is already resolved');
  }
  const assignee = event.assignments[0]?.technician;
  if (actor.role !== 'ADMIN') {
    if (actor.role !== 'TECHNICIAN' || actor.id !== assignee?.id) {
      throw forbidden('Only the assigned technician or an Admin can resolve');
    }
    if (event.status !== 'ACKNOWLEDGED') {
      throw conflict(
        ERROR_CODES.MUST_ACKNOWLEDGE_FIRST,
        'You must acknowledge this event before resolving it',
      );
    }
  }
  await db.$transaction([
    db.productionEvent.update({
      where: { id: eventId },
      data: {
        status: 'RESOLVED',
        resolutionNotes,
        resolvedById: actor.id,
        resolvedAt: new Date(),
      },
    }),
    db.historyEntry.create({
      data: { eventId, action: 'RESOLVED', actorId: actor.id, detail: resolutionNotes },
    }),
  ]);
  return getEventDetail(eventId);
}

export async function reassign(
  actor: Actor,
  eventId: string,
  technicianId: string,
): Promise<EventDetailDTO> {
  const db = getPrisma();
  const event = await requireEvent(db, eventId);
  if (!ACTIVE_STATUSES.includes(event.status as (typeof ACTIVE_STATUSES)[number])) {
    throw httpError(409, ERROR_CODES.NOT_ASSIGNED, 'Resolved events cannot be reassigned');
  }
  const target = await db.user.findUnique({
    where: { id: technicianId },
    select: { id: true, name: true, role: true, email: true },
  });
  if (!target) {
    throw notFound('Technician not found');
  }
  if (target.role !== 'TECHNICIAN') {
    throw badRequest('Target user is not a technician');
  }
  await db.$transaction(async (tx) => {
    await tx.assignment.updateMany({
      where: { eventId, active: true },
      data: { active: false },
    });
    await tx.assignment.create({
      data: { eventId, technicianId, active: true },
    });
    // Fresh window for the new assignee (FR-112: a new deadline starts on
    // reassignment); reset the hop counter.
    const now = new Date();
    const windowMinutes = await windowFor(event.severity, tx as ReturnType<typeof getPrisma>);
    await tx.productionEvent.update({
      where: { id: eventId },
      data: {
        escalationStep: 0,
        ackDeadline:
          windowMinutes != null ? new Date(now.getTime() + windowMinutes * 60_000) : null,
      },
    });
    await tx.historyEntry.create({
      data: {
        eventId,
        action: 'REASSIGNED' as HistoryAction,
        actorId: actor.id,
        detail: target.name,
      },
    });
  });
  const fullEvent = await db.productionEvent.findUniqueOrThrow({ where: { id: eventId } });
  await recordAndSend(fullEvent, target);
  return getEventDetail(eventId);
}

async function requireEvent(
  db: Prisma.TransactionClient | ReturnType<typeof getPrisma>,
  eventId: string,
): Promise<EventWithRelations> {
  const event = await db.productionEvent.findUnique({
    where: { id: eventId },
    include: detailInclude,
  });
  if (!event) {
    throw notFound('Production event not found');
  }
  return event;
}

function toDetailDTO(
  e: EventWithRelations,
  targets: Record<Severity, SlaTargets>,
): EventDetailDTO {
  const assignee: UserDTO | null = e.assignments[0]
    ? {
        id: e.assignments[0].technician.id,
        name: e.assignments[0].technician.name,
        role: e.assignments[0].technician.role,
      }
    : null;
  const sla = evaluateSla(e, targets[e.severity], new Date());
  return {
    id: e.id,
    title: e.title,
    severity: e.severity,
    status: e.status,
    machineRef: e.machineRef,
    createdAt: e.createdAt.toISOString(),
    unassigned: assignee === null,
    slaBreached: sla.acknowledge.status === 'BREACHED' || sla.resolve.status === 'BREACHED',
    description: e.description,
    reporter: e.reporter,
    assignee,
    acknowledgedAt: e.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: e.resolvedAt?.toISOString() ?? null,
    resolutionNotes: e.resolutionNotes,
    history: e.history.map((h) => ({
      id: h.id,
      action: h.action,
      actor: h.actor,
      detail: h.detail,
      createdAt: h.createdAt.toISOString(),
    })),
    // Computed at read time with current targets (FR-205/207).
    sla,
  };
}

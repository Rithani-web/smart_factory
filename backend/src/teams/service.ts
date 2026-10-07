import {
  ERROR_CODES,
  ROTATION_CADENCES,
  type RotationCadence,
  type TeamDTO,
  type TeamRequest,
} from '@smart-factory/types';
import type { Prisma } from '@prisma/client';

import { badRequest, httpError, notFound } from '../shared/errors.ts';
import { getPrisma } from '../shared/prisma.ts';
import { onDutyIndex } from './rotation.ts';

const teamInclude = {
  members: {
    orderBy: { position: 'asc' as const },
    include: { technician: { select: { id: true, name: true, role: true } } },
  },
  escalationAdmin: { select: { id: true, name: true, role: true } },
} satisfies Prisma.TeamInclude;

type TeamWithRelations = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;

function toTeamDTO(team: TeamWithRelations, now: Date): TeamDTO {
  const members = team.members.map((m) => ({
    id: m.technician.id,
    name: m.technician.name,
    role: m.technician.role,
    position: m.position,
  }));
  const idx = onDutyIndex(team.cadence, team.anchorAt, now, members.length);
  return {
    id: team.id,
    name: team.name,
    cadence: team.cadence,
    anchorAt: team.anchorAt.toISOString(),
    members,
    onDuty: idx >= 0 ? members[idx] : null,
    escalationAdmin: team.escalationAdmin,
  };
}

export async function listTeams(now = new Date()): Promise<TeamDTO[]> {
  const teams = await getPrisma().team.findMany({
    orderBy: { createdAt: 'asc' },
    include: teamInclude,
  });
  return teams.map((t) => toTeamDTO(t, now));
}

/** The assignment/escalation source: first team by creation, its ordered
 * active member list. Returns null when no usable team exists (FR-105). */
export async function firstTeamRotation(
  now = new Date(),
  db: Prisma.TransactionClient | ReturnType<typeof getPrisma> = getPrisma(),
): Promise<{ members: { id: string; name: string }[]; onDutyIndex: number; team: { id: string; escalationAdminId: string | null } } | null> {
  const team = await db.team.findFirst({
    orderBy: { createdAt: 'asc' },
    include: teamInclude,
  });
  if (!team || team.members.length === 0) {
    return null;
  }
  return {
    members: team.members.map((m) => ({ id: m.technician.id, name: m.technician.name })),
    onDutyIndex: onDutyIndex(team.cadence, team.anchorAt, now, team.members.length),
    team: { id: team.id, escalationAdminId: team.escalationAdminId },
  };
}

export async function createTeam(input: TeamRequest): Promise<TeamDTO> {
  const { name, cadence, anchorAt, memberIds, escalationAdminId } = validateTeamInput(input);
  const db = getPrisma();
  await db.$transaction(async (tx) => {
    await tx.team.create({
      data: {
        name,
        cadence,
        anchorAt,
        escalationAdminId: escalationAdminId ?? null,
        members: {
          create: memberIds.map((technicianId, position) => ({ technicianId, position })),
        },
      },
    });
  });
  const created = await db.team.findFirstOrThrow({
    where: { name },
    include: teamInclude,
  });
  return toTeamDTO(created, new Date());
}

export async function updateTeam(id: string, input: TeamRequest): Promise<TeamDTO> {
  const { name, cadence, anchorAt, memberIds, escalationAdminId } = validateTeamInput(input);
  const db = getPrisma();
  const existing = await db.team.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Team not found');
  }
  await db.$transaction(async (tx) => {
    await tx.teamMembership.deleteMany({ where: { teamId: id } });
    await tx.team.update({
      where: { id },
      data: {
        name,
        cadence,
        anchorAt,
        escalationAdminId: escalationAdminId ?? null,
      },
    });
    await tx.teamMembership.createMany({
      data: memberIds.map((technicianId, position) => ({ teamId: id, technicianId, position })),
    });
  });
  const updated = await db.team.findUniqueOrThrow({ where: { id }, include: teamInclude });
  return toTeamDTO(updated, new Date());
}

function validateTeamInput(input: TeamRequest): {
  name: string;
  cadence: RotationCadence;
  anchorAt: Date;
  memberIds: string[];
  escalationAdminId: string | null;
} {
  const { name, cadence, anchorAt, memberIds, escalationAdminId } = input;
  if (!name || !name.trim()) {
    throw badRequest('Team name is required');
  }
  if (!cadence || !ROTATION_CADENCES.includes(cadence)) {
    throw badRequest('cadence must be WEEKLY or DAILY');
  }
  const anchor = anchorAt ? new Date(anchorAt) : null;
  if (!anchor || Number.isNaN(anchor.getTime())) {
    throw badRequest('anchorAt must be a valid ISO date-time');
  }
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    throw badRequest('memberIds must be a non-empty ordered list of technicians');
  }
  const db = getPrisma();
  const techs = db.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, role: true },
  });
  void techs; // validation happens in route-level await below
  return { name: name.trim(), cadence, anchorAt: anchor, memberIds, escalationAdminId: escalationAdminId ?? null };
}

/** Async member validation shared by create/update (throws 400 on any
 * non-technician or unknown id). */
export async function assertTechnicianIds(memberIds: string[]): Promise<void> {
  const users = await getPrisma().user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, role: true },
  });
  const byId = new Map(users.map((u) => [u.id, u.role]));
  for (const id of memberIds) {
    const role = byId.get(id);
    if (!role) {
      throw httpError(400, ERROR_CODES.VALIDATION, 'Unknown technician in memberIds');
    }
    if (role !== 'TECHNICIAN') {
      throw badRequest('All members must be technicians');
    }
  }
}

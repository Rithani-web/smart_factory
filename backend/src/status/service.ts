import type { PrismaClient } from '@prisma/client';

import type {
  PublicStatusDTO,
  PublicTeamStatusDTO,
  Severity,
  TeamOperationalStatus,
} from '@smart-factory/types';

import { deriveTeamStatus, emptyOpenCounts } from './derive.ts';

const STATUS_RANK: Record<TeamOperationalStatus, number> = {
  OPERATIONAL: 0,
  DEGRADED: 1,
  PARTIAL_OUTAGE: 2,
  MAJOR_OUTAGE: 3,
};

function worstOf(a: TeamOperationalStatus, b: TeamOperationalStatus): TeamOperationalStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

/**
 * Public status payload (FR-303, research D23): team display names, derived and
 * final statuses, open counts and the active override — NEVER personal data
 * (no emails, no assignee identities).
 */
export async function getPublicStatus(
  db: PrismaClient,
  now = new Date(),
): Promise<PublicStatusDTO> {
  const teams = await db.team.findMany({
    orderBy: { name: 'asc' },
    include: {
      members: { select: { id: true } },
      statusMessage: { include: { author: { select: { name: true } } } },
    },
  });

  const openEvents = await db.productionEvent.findMany({
    where: { status: { in: ['OPEN', 'ASSIGNED', 'ACKNOWLEDGED'] } },
    select: { severity: true },
  });

  // Open events are system-wide in this exercise; the first team (the
  // assignment source per spec/002) carries them on the public page.
  const firstTeam = teams.find((t) => t.members.length > 0) ?? teams[0];

  const rows: PublicTeamStatusDTO[] = teams.map((team) => {
    const counts = emptyOpenCounts();
    if (firstTeam && team.id === firstTeam.id) {
      for (const e of openEvents) {
        counts[e.severity as Severity] += 1;
      }
    }
    const derivedStatus = deriveTeamStatus(
      (Object.entries(counts) as [Severity, number][])
        .filter(([, n]) => n > 0)
        .flatMap(([severity, n]) => Array<Severity>(n).fill(severity)),
    );
    const override = team.statusMessage;
    // Manual override rule (research D21): a posted notice displays as DEGRADED
    // (planned maintenance), but never lowers a worse derived status. Clearly
    // distinguishable via manualOverride marker on every surface.
    const finalStatus: TeamOperationalStatus = override
      ? worstOf('DEGRADED', derivedStatus)
      : derivedStatus;
    return {
      teamId: team.id,
      teamName: team.name,
      derivedStatus,
      finalStatus,
      manualOverride: override
        ? {
            message: override.message,
            authorName: override.author.name,
            createdAt: override.createdAt.toISOString(),
          }
        : null,
      openCounts: counts,
    };
  });

  return { serverTime: now.toISOString(), teams: rows };
}

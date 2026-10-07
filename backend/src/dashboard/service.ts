import {
  DASHBOARD_PERIODS,
  SEVERITIES,
  type DashboardPeriodDays,
  type DashboardSummaryDTO,
  type Severity,
} from '@smart-factory/types';

import { getPrisma } from '../shared/prisma.ts';
import { evaluateSla } from '../sla/engine.ts';
import { slaTargetsMap } from '../sla/service.ts';
import { firstTeamRotation } from '../teams/service.ts';

const OPEN_STATUSES = ['OPEN', 'ASSIGNED', 'ACKNOWLEDGED'] as const;

export interface DashboardFilter {
  teamId: string | null;
  days: DashboardPeriodDays;
}

/** Non-admin default: teams the user is a member of, fallback all (FR-302). */
export async function resolveFilter(
  role: 'ADMIN' | 'TECHNICIAN' | 'VIEWER',
  userId: string,
  rawTeamId: string | null,
  rawDays: string | null,
): Promise<DashboardFilter> {
  const days = DASHBOARD_PERIODS.includes(Number(rawDays) as DashboardPeriodDays)
    ? (Number(rawDays) as DashboardPeriodDays)
    : 7;
  let teamId: string | null = null;
  if (role === 'ADMIN') {
    teamId = rawTeamId; // null = all teams
  } else if (rawTeamId) {
    teamId = rawTeamId; // read-only switch is permitted (clarified Q4)
  } else {
    const memberships = await getPrisma().teamMembership.findMany({
      where: { technicianId: userId },
      select: { teamId: true },
    });
    teamId = memberships.length > 0 ? memberships[0].teamId : null;
  }
  return { teamId, days };
}

export async function getDashboardSummary(
  filter: DashboardFilter,
  now = new Date(),
): Promise<DashboardSummaryDTO> {
  const db = getPrisma();
  const windowStart = new Date(now.getTime() - filter.days * 24 * 60 * 60 * 1000);

  const [openBySeverityRows, teams, createdInRange, targets, rotation] = await Promise.all([
    db.productionEvent.groupBy({
      by: ['severity'],
      where: { status: { in: [...OPEN_STATUSES] } },
      _count: { severity: true },
    }),
    db.team.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        members: {
          orderBy: { position: 'asc' },
          include: { technician: { select: { id: true, name: true } } },
        },
      },
    }),
    db.productionEvent.findMany({
      where: { createdAt: { gte: windowStart, lte: now } },
      select: {
        id: true,
        severity: true,
        createdAt: true,
        acknowledgedAt: true,
        resolvedAt: true,
        status: true,
      },
    }),
    slaTargetsMap(db),
    firstTeamRotation(now, db),
  ]);

  const openBySeverity = SEVERITIES.reduce(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {} as Record<Severity, number>,
  );
  for (const row of openBySeverityRows) {
    openBySeverity[row.severity] = row._count.severity;
  }

  // Volume: UTC-day buckets of created events in the window.
  const buckets = new Map<string, number>();
  for (let d = filter.days - 1; d >= 0; d--) {
    const day = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    buckets.set(day.toISOString().slice(0, 10), 0);
  }
  for (const e of createdInRange) {
    const key = e.createdAt.toISOString().slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  // SLA compliance over events created in the window (clarified Q2):
  // due = no PENDING dimension; met = both dimensions MET.
  let total = 0;
  let met = 0;
  for (const e of createdInRange) {
    const sla = evaluateSla(e, targets[e.severity], now);
    if (sla.acknowledge.status === 'PENDING' || sla.resolve.status === 'PENDING') {
      continue;
    }
    total += 1;
    if (sla.acknowledge.status === 'MET' && sla.resolve.status === 'MET') {
      met += 1;
    }
  }

  const scopedTeams = filter.teamId ? teams.filter((t) => t.id === filter.teamId) : teams;

  return {
    openBySeverity,
    teams: scopedTeams.map((t) => ({
      id: t.id,
      name: t.name,
      onDutyName:
        rotation && t.id === rotation.team.id
          ? (rotation.members[rotation.onDutyIndex]?.name ?? null)
          : (t.members[0]?.technician.name ?? null),
    })),
    sla: { total, met, rate: total > 0 ? met / total : null },
    volume: [...buckets.entries()].map(([date, count]) => ({ date, count })),
    appliedFilter: { teamId: filter.teamId, days: filter.days },
  };
}

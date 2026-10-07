import {
  SEVERITIES,
  type Severity,
  type SlaTargetsDTO,
  type UpdateSlaTargetsRequest,
} from '@smart-factory/types';

import { badRequest } from '../shared/errors.ts';
import { getPrisma } from '../shared/prisma.ts';
import type { SlaTargets } from './engine.ts';

/** Sensible defaults (clarified Q1) — also the fallback when rows are absent. */
export const DEFAULT_SLA_TARGETS: Record<Severity, SlaTargets> = {
  CRITICAL: { ackMinutes: 5, resolveMinutes: 60 },
  HIGH: { ackMinutes: 15, resolveMinutes: 240 },
  MEDIUM: { ackMinutes: 60, resolveMinutes: 480 },
  LOW: { ackMinutes: 240, resolveMinutes: 1440 },
};

export async function getSlaTargets(): Promise<SlaTargetsDTO> {
  const rows = await getPrisma().slaTarget.findMany();
  const bySeverity = new Map(rows.map((r) => [r.severity, r]));
  return {
    targets: SEVERITIES.map((severity) => ({
      severity,
      ackMinutes: bySeverity.get(severity)?.ackMinutes ?? DEFAULT_SLA_TARGETS[severity].ackMinutes,
      resolveMinutes:
        bySeverity.get(severity)?.resolveMinutes ?? DEFAULT_SLA_TARGETS[severity].resolveMinutes,
    })),
  };
}

/** Batch severity→targets map for list/detail evaluation (research D19). */
export async function slaTargetsMap(
  db: ReturnType<typeof getPrisma> = getPrisma(),
): Promise<Record<Severity, SlaTargets>> {
  const rows = await db.slaTarget.findMany();
  const bySeverity = new Map(rows.map((r) => [r.severity, r]));
  return SEVERITIES.reduce(
    (acc, severity) => {
      acc[severity] = {
        ackMinutes: bySeverity.get(severity)?.ackMinutes ?? DEFAULT_SLA_TARGETS[severity].ackMinutes,
        resolveMinutes:
          bySeverity.get(severity)?.resolveMinutes ?? DEFAULT_SLA_TARGETS[severity].resolveMinutes,
      };
      return acc;
    },
    {} as Record<Severity, SlaTargets>,
  );
}

export async function updateSlaTargets(input: UpdateSlaTargetsRequest): Promise<SlaTargetsDTO> {
  const { targets } = input;
  if (!targets || typeof targets !== 'object') {
    throw badRequest('targets object is required');
  }
  const db = getPrisma();
  for (const [severity, value] of Object.entries(targets)) {
    if (!SEVERITIES.includes(severity as Severity)) {
      throw badRequest(`Unknown severity: ${severity}`);
    }
    if (!value || value.ackMinutes < 1 || value.resolveMinutes < 1) {
      throw badRequest(`${severity} targets must be positive minute values`);
    }
    await db.slaTarget.upsert({
      where: { severity: severity as Severity },
      update: { ackMinutes: value.ackMinutes, resolveMinutes: value.resolveMinutes },
      create: {
        severity: severity as Severity,
        ackMinutes: value.ackMinutes,
        resolveMinutes: value.resolveMinutes,
      },
    });
  }
  return getSlaTargets();
}

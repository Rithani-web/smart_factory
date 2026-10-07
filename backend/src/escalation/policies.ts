import {
  SEVERITIES,
  type PoliciesDTO,
  type Severity,
  type UpdatePoliciesRequest,
} from '@smart-factory/types';

import { badRequest } from '../shared/errors.ts';
import { getPrisma } from '../shared/prisma.ts';

export const DEFAULT_WINDOWS: Record<string, number | null> = {
  CRITICAL: 5,
  HIGH: 15,
  MEDIUM: 60,
  LOW: null,
};

export async function getPolicies(): Promise<PoliciesDTO> {
  const rows = await getPrisma().escalationPolicy.findMany();
  const bySeverity = new Map(rows.map((r) => [r.severity, r.windowMinutes]));
  return {
    policies: SEVERITIES.map((severity) => ({
      severity,
      windowMinutes:
        bySeverity.has(severity) ? (bySeverity.get(severity) as number | null) : DEFAULT_WINDOWS[severity],
    })),
  };
}

/** Window for a severity in minutes, or null = never escalates (FR-106). */
export async function windowFor(
  severity: Severity,
  db: ReturnType<typeof getPrisma>,
): Promise<number | null> {
  const row = await db.escalationPolicy.findUnique({ where: { severity } });
  if (row) {
    return row.windowMinutes;
  }
  return DEFAULT_WINDOWS[severity] ?? null;
}

export async function updatePolicies(input: UpdatePoliciesRequest): Promise<PoliciesDTO> {
  const { windows } = input;
  if (!windows || typeof windows !== 'object') {
    throw badRequest('windows object is required');
  }
  const db = getPrisma();
  for (const severity of SEVERITIES) {
    if (!(severity in windows)) {
      continue;
    }
    const value = windows[severity];
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 1)) {
      throw badRequest(`${severity} window must be a positive number of minutes or null`);
    }
    await db.escalationPolicy.upsert({
      where: { severity },
      update: { windowMinutes: value },
      create: { severity, windowMinutes: value },
    });
  }
  return getPolicies();
}

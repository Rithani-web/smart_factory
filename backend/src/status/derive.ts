import type {
  OpenSeverityCounts,
  Severity,
  TeamOperationalStatus,
} from '@smart-factory/types';

const SEVERITY_RANK: Record<Severity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

/**
 * Derived team status (FR-304, clarified Q1, research D21): the highest open
 * severity wins. Pure — unit-tested with the full matrix.
 */
export function deriveTeamStatus(openSeverities: Severity[]): TeamOperationalStatus {
  if (openSeverities.length === 0) {
    return 'OPERATIONAL';
  }
  const max = openSeverities.reduce((m, s) => Math.max(m, SEVERITY_RANK[s]), 0);
  if (max >= SEVERITY_RANK.CRITICAL) return 'MAJOR_OUTAGE';
  if (max >= SEVERITY_RANK.HIGH) return 'PARTIAL_OUTAGE';
  return 'DEGRADED'; // LOW or MEDIUM present
}

export function emptyOpenCounts(): OpenSeverityCounts {
  return { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
}

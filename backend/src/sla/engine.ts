import type { SlaDimensionDTO, SlaEvaluationDTO, SlaStatus } from '@smart-factory/types';

export interface SlaEngineInput {
  createdAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
}

export interface SlaTargets {
  ackMinutes: number;
  resolveMinutes: number;
}

function roundMinutes(ms: number): number {
  return Math.round((ms / 60_000) * 10) / 10;
}

function dimension(
  targetMinutes: number,
  doneAt: Date | null,
  createdAt: Date,
  now: Date,
): SlaDimensionDTO {
  const targetMs = targetMinutes * 60_000;
  if (doneAt) {
    const elapsedMs = doneAt.getTime() - createdAt.getTime();
    // Boundary (US3-2/3-3): exactly at the target counts as MET.
    return {
      targetMinutes,
      actualMinutes: roundMinutes(elapsedMs),
      status: (elapsedMs <= targetMs ? 'MET' : 'BREACHED') as SlaStatus,
    };
  }
  const openMs = now.getTime() - createdAt.getTime();
  if (openMs > targetMs) {
    // Live breach on a still-open event (FR-206) — no resolution needed.
    return { targetMinutes, actualMinutes: roundMinutes(openMs), status: 'BREACHED' };
  }
  return { targetMinutes, actualMinutes: 0, status: 'PENDING' };
}

/**
 * Pure SLA evaluation (spec/003 FR-205…208, research D17): deterministic
 * function of report/ack/resolve times, current targets and the injected
 * clock. No DB access, no clock reads — fully unit-testable.
 */
export function evaluateSla(
  input: SlaEngineInput,
  targets: SlaTargets,
  now: Date,
): SlaEvaluationDTO {
  return {
    acknowledge: dimension(targets.ackMinutes, input.acknowledgedAt, input.createdAt, now),
    resolve: dimension(targets.resolveMinutes, input.resolvedAt, input.createdAt, now),
  };
}

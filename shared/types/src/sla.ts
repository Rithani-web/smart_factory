import type { Severity } from './event.ts';

export const SLA_STATUSES = ['MET', 'BREACHED', 'PENDING'] as const;
export type SlaStatus = (typeof SLA_STATUSES)[number];

/** One SLA dimension (acknowledge or resolve) for one event (FR-205). */
export interface SlaDimensionDTO {
  targetMinutes: number;
  /** Elapsed minutes (1 decimal): actual when done, live elapsed when open and
   * past due, 0 while PENDING. */
  actualMinutes: number;
  status: SlaStatus;
}

export interface SlaEvaluationDTO {
  acknowledge: SlaDimensionDTO;
  resolve: SlaDimensionDTO;
}

export interface SlaTargetDTO {
  severity: Severity;
  ackMinutes: number;
  resolveMinutes: number;
}

export interface SlaTargetsDTO {
  targets: SlaTargetDTO[];
}

export interface UpdateSlaTargetsRequest {
  targets: Partial<Record<Severity, { ackMinutes: number; resolveMinutes: number }>>;
}

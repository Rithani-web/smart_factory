import type { Severity } from './event.ts';

export interface EscalationPolicyDTO {
  severity: Severity;
  windowMinutes: number | null;
}

export interface PoliciesDTO {
  policies: EscalationPolicyDTO[];
}

/** PUT /escalation-policies — minutes ≥ 1, or null = never escalates. */
export interface UpdatePoliciesRequest {
  windows: Partial<Record<Severity, number | null>>;
}

import type { Severity } from './event.ts';
import type { OpenSeverityCounts } from './status.ts';

export const DASHBOARD_PERIODS = [7, 30, 90] as const;
export type DashboardPeriodDays = (typeof DASHBOARD_PERIODS)[number];

export interface DashboardTeamOnDutyDTO {
  id: string;
  name: string;
  onDutyName: string | null;
}

export interface DashboardSlaComplianceDTO {
  /** events created in the window with no PENDING dimension */
  total: number;
  met: number;
  /** met/total as 0..1, null when total = 0 */
  rate: number | null;
}

export interface DashboardVolumeBucketDTO {
  /** UTC date 'YYYY-MM-DD' */
  date: string;
  count: number;
}

export interface DashboardSummaryDTO {
  openBySeverity: OpenSeverityCounts & Record<Severity, number>;
  teams: DashboardTeamOnDutyDTO[];
  sla: DashboardSlaComplianceDTO;
  volume: DashboardVolumeBucketDTO[];
  appliedFilter: { teamId: string | null; days: DashboardPeriodDays };
}

export interface SetStatusMessageRequest {
  message: string;
}

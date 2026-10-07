export const TEAM_OPERATIONAL_STATUSES = [
  'OPERATIONAL',
  'DEGRADED',
  'PARTIAL_OUTAGE',
  'MAJOR_OUTAGE',
] as const;
export type TeamOperationalStatus = (typeof TEAM_OPERATIONAL_STATUSES)[number];

export interface OpenSeverityCounts {
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
}

export interface ManualOverrideDTO {
  message: string;
  authorName: string;
  createdAt: string;
}

export interface PublicTeamStatusDTO {
  teamId: string;
  teamName: string;
  derivedStatus: TeamOperationalStatus;
  /** final = manual override ?? derived */
  finalStatus: TeamOperationalStatus;
  manualOverride: ManualOverrideDTO | null;
  openCounts: OpenSeverityCounts;
}

export interface PublicStatusDTO {
  serverTime: string;
  teams: PublicTeamStatusDTO[];
}

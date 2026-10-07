import type { UserDTO } from './user.ts';

export const ROTATION_CADENCES = ['WEEKLY', 'DAILY'] as const;
export type RotationCadence = (typeof ROTATION_CADENCES)[number];

export interface TeamMemberDTO extends UserDTO {
  position: number;
}

/** GET /teams row (any signed-in role). On-duty is rotation-computed server-side. */
export interface TeamDTO {
  id: string;
  name: string;
  cadence: RotationCadence;
  anchorAt: string;
  members: TeamMemberDTO[];
  onDuty: UserDTO | null;
  escalationAdmin: UserDTO | null;
}

export interface TeamRequest {
  name: string;
  cadence: RotationCadence;
  anchorAt: string;
  /** Ordered technician ids — position = array index. */
  memberIds: string[];
  escalationAdminId?: string | null;
}

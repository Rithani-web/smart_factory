/** Roles, server-enforced (Constitution II). Domain mapping of the original
 * Admin/Responder/Viewer — see docs/DOMAIN-MAPPING.md. */
export const ROLES = ['ADMIN', 'TECHNICIAN', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

/** User as exposed by ANY API response or view. Email is internal-only —
 * never displayed (FR-018). */
export interface UserDTO {
  id: string;
  name: string;
  role: Role;
}

/** Login/session payload — the only place mustChangePassword is exposed. */
export interface SessionUserDTO extends UserDTO {
  mustChangePassword: boolean;
}

import type { Role, SessionUserDTO, UserDTO } from './user.ts';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: SessionUserDTO;
}

export interface RefreshResponse {
  user: SessionUserDTO;
}

export interface CompletePasswordChangeRequest {
  newPassword: string;
}

/** POST /users (ADMIN) — 201 response. Temporary password is shown exactly once. */
export interface CreateUserRequest {
  name: string;
  email: string;
  role: Role;
}

export interface CreateUserResponse {
  user: UserDTO;
  temporaryPassword: string;
}

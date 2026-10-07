import type { LoginResponse, RefreshResponse } from '@smart-factory/types';

import { api } from './api.ts';

export function login(email: string, password: string): Promise<LoginResponse> {
  return api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/** Session restore: the refresh endpoint doubles as "who am I" (401 = signed out). */
export function me(): Promise<RefreshResponse> {
  return api<RefreshResponse>('/auth/refresh', { method: 'POST' });
}

export function logout(): Promise<void> {
  return api<void>('/auth/logout', { method: 'POST' });
}

export function completePasswordChange(newPassword: string): Promise<RefreshResponse> {
  return api<RefreshResponse>('/auth/complete-password-change', {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
}

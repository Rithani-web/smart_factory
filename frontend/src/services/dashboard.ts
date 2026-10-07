import type {
  DashboardPeriodDays,
  DashboardSummaryDTO,
  PublicStatusDTO,
} from '@smart-factory/types';

import { api } from './api.ts';

export function dashboardSummary(
  days: DashboardPeriodDays,
  teamId?: string | null,
): Promise<DashboardSummaryDTO> {
  const q = new URLSearchParams({ days: String(days) });
  if (teamId) {
    q.set('teamId', teamId);
  }
  return api<DashboardSummaryDTO>(`/dashboard/summary?${q.toString()}`);
}

export function publicStatus(): Promise<PublicStatusDTO> {
  return fetch('/api/public/status').then(async (res) => {
    if (!res.ok) {
      throw new Error(`Status unavailable (${res.status})`);
    }
    return (await res.json()) as PublicStatusDTO;
  });
}

export function setStatusMessage(
  teamId: string,
  message: string,
): Promise<unknown> {
  return api<unknown>(`/teams/${teamId}/status-message`, {
    method: 'PUT',
    body: JSON.stringify({ message }),
  });
}

export function clearStatusMessage(teamId: string): Promise<void> {
  return api<void>(`/teams/${teamId}/status-message`, { method: 'DELETE' });
}

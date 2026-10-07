import type {
  CreateEventResponse,
  EventDTO,
  EventDetailDTO,
  ReassignResponse,
  ResolveResponse,
  UserDTO,
  CreateUserResponse,
  AcknowledgeResponse,
  Role,
} from '@smart-factory/types';

import { api } from './api.ts';

export function listEvents(): Promise<EventDTO[]> {
  return api<EventDTO[]>('/events');
}

export function getEvent(id: string): Promise<EventDetailDTO> {
  return api<EventDetailDTO>(`/events/${id}`);
}

export function createEvent(input: {
  title: string;
  description: string;
  machineRef: string;
  severity: string;
}): Promise<CreateEventResponse> {
  return api<CreateEventResponse>('/events', { method: 'POST', body: JSON.stringify(input) });
}

export function acknowledgeEvent(id: string): Promise<AcknowledgeResponse> {
  return api<AcknowledgeResponse>(`/events/${id}/acknowledge`, { method: 'POST' });
}

export function resolveEvent(id: string, resolutionNotes: string): Promise<ResolveResponse> {
  return api<ResolveResponse>(`/events/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolutionNotes }),
  });
}

export function reassignEvent(id: string, technicianId: string): Promise<ReassignResponse> {
  return api<ReassignResponse>(`/events/${id}/reassign`, {
    method: 'POST',
    body: JSON.stringify({ technicianId }),
  });
}

export function listUsers(): Promise<UserDTO[]> {
  return api<UserDTO[]>('/users');
}

export function createUser(name: string, email: string, role: Role): Promise<CreateUserResponse> {
  return api<CreateUserResponse>('/users', {
    method: 'POST',
    body: JSON.stringify({ name, email, role }),
  });
}

import type { UserDTO } from './user.ts';

export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const EVENT_STATUSES = ['OPEN', 'ASSIGNED', 'ACKNOWLEDGED', 'RESOLVED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const HISTORY_ACTIONS = [
  'CREATED',
  'ASSIGNED',
  'REASSIGNED',
  'ACKNOWLEDGED',
  'RESOLVED',
] as const;
export type HistoryAction = (typeof HISTORY_ACTIONS)[number];

/** List row — GET /events (FR-015). */
export interface EventDTO {
  id: string;
  title: string;
  severity: Severity;
  status: EventStatus;
  machineRef: string;
  createdAt: string;
  /** true when the event has no active assignment (FR-008, SC-006). */
  unassigned: boolean;
}

export interface HistoryDTO {
  id: string;
  action: HistoryAction;
  actor: UserDTO;
  detail: string | null;
  createdAt: string;
}

/** Full detail — GET /events/:id. Personal data is UserDTO only (FR-018). */
export interface EventDetailDTO extends EventDTO {
  description: string;
  reporter: UserDTO;
  assignee: UserDTO | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  history: HistoryDTO[];
}

export interface CreateEventRequest {
  title: string;
  description: string;
  machineRef: string;
  severity: Severity;
}

/** Set when creation left the event OPEN because nobody is on duty (FR-008). */
export interface CreateEventResponse {
  event: EventDetailDTO;
  unassigned: boolean;
}

export interface AcknowledgeResponse {
  event: EventDetailDTO;
}

export interface ResolveEventRequest {
  resolutionNotes: string;
}

export interface ResolveResponse {
  event: EventDetailDTO;
}

export interface ReassignEventRequest {
  technicianId: string;
}

export interface ReassignResponse {
  event: EventDetailDTO;
}

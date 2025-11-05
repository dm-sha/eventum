import apiClient from './client';
import { shouldUseSubdomainApi, shouldUseContainerApi } from '../utils/eventumSlug';

import type { Event } from '../types';

export interface EventWaveEventInfo {
  id: number;
  name: string;
  participant_type: 'all' | 'registration' | 'manual';
  max_participants: number | null;
  registrations_count: number;
  available_participants: number;
  already_assigned_count: number;
  available_without_unassigned_events: number;
  can_convert: boolean;
  can_convert_normal: boolean;
}

export interface EventWave {
  id: number;
  name: string;
  eventum: number;
  registrations: any[]; // EventRegistration[]
  events: Event[]; // Full Event objects from the serializer
}

export interface CreateEventWaveDto {
  name: string;
  registration_ids?: number[];
}

export interface UpdateEventWaveDto {
  name?: string;
  registration_ids?: number[];
}

export async function listEventWaves(eventumSlug: string, participantId?: number): Promise<EventWave[]> {
  if (shouldUseSubdomainApi()) {
    const { data } = await apiClient.get('/event-waves/', {
      params: participantId ? { participant: participantId } : undefined,
    });
    return data;
  } else if (shouldUseContainerApi()) {
    const { data } = await apiClient.get(`/eventums/${eventumSlug}/event-waves/`, {
      params: participantId ? { participant: participantId } : undefined,
    });
    return data;
  } else {
    const { data } = await apiClient.get(`/eventums/${eventumSlug}/event-waves/`, {
      params: participantId ? { participant: participantId } : undefined,
    });
    return data;
  }
}

export async function createEventWave(eventumSlug: string, dto: CreateEventWaveDto): Promise<EventWave> {
  if (shouldUseSubdomainApi()) {
    const { data } = await apiClient.post('/event-waves/', dto);
    return data;
  } else if (shouldUseContainerApi()) {
    const { data } = await apiClient.post(`/eventums/${eventumSlug}/event-waves/`, dto);
    return data;
  } else {
    const { data } = await apiClient.post(`/eventums/${eventumSlug}/event-waves/`, dto);
    return data;
  }
}

export async function updateEventWave(eventumSlug: string, id: number, dto: UpdateEventWaveDto): Promise<EventWave> {
  if (shouldUseSubdomainApi()) {
    const { data } = await apiClient.patch(`/event-waves/${id}/`, dto);
    return data;
  } else if (shouldUseContainerApi()) {
    const { data } = await apiClient.patch(`/eventums/${eventumSlug}/event-waves/${id}/`, dto);
    return data;
  } else {
    const { data } = await apiClient.patch(`/eventums/${eventumSlug}/event-waves/${id}/`, dto);
    return data;
  }
}

export async function deleteEventWave(eventumSlug: string, id: number): Promise<void> {
  if (shouldUseSubdomainApi()) {
    await apiClient.delete(`/event-waves/${id}/`);
  } else if (shouldUseContainerApi()) {
    await apiClient.delete(`/eventums/${eventumSlug}/event-waves/${id}/`);
  } else {
    await apiClient.delete(`/eventums/${eventumSlug}/event-waves/${id}/`);
  }
}




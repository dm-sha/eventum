import apiClient from './client';
import { shouldUseSubdomainApi, shouldUseContainerApi } from '../utils/eventumSlug';

export interface EventWaveEventInfo {
  id: number;
  name: string;
  participant_type: 'all' | 'registration' | 'manual';
  max_participants: number | null;
  registrations_count: number;
  available_participants: number;
  already_assigned_count: number;
  assigned_participants_count: number;
  available_without_unassigned_events: number;
  can_convert: boolean;
  can_convert_normal: boolean;
}

export interface EventWave {
  id: number;
  name: string;
  tag: { id: number; name: string; slug: string };
  events: EventWaveEventInfo[];
  whitelist_groups: { id: number; name: string; slug: string }[];
  whitelist_group_tags: { id: number; name: string; slug: string }[];
  blacklist_groups: { id: number; name: string; slug: string }[];
  blacklist_group_tags: { id: number; name: string; slug: string }[];
}

export interface CreateEventWaveDto {
  name: string;
  tag_id: number;
  whitelist_group_ids?: number[];
  whitelist_group_tag_ids?: number[];
  blacklist_group_ids?: number[];
  blacklist_group_tag_ids?: number[];
}

export interface UpdateEventWaveDto {
  name: string;
  whitelist_group_ids?: number[];
  whitelist_group_tag_ids?: number[];
  blacklist_group_ids?: number[];
  blacklist_group_tag_ids?: number[];
}

export async function listEventWaves(eventumSlug: string): Promise<EventWave[]> {
  if (shouldUseSubdomainApi()) {
    const { data } = await apiClient.get('/event-waves/');
    return data;
  } else if (shouldUseContainerApi()) {
    const { data } = await apiClient.get(`/eventums/${eventumSlug}/event-waves/`);
    return data;
  } else {
    const { data } = await apiClient.get(`/eventums/${eventumSlug}/event-waves/`);
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

export interface WaveConversionResult {
  event_id: number;
  event_name: string;
  participants_count: number;
  fill_percentage: number;
}

export interface WaveConversionResponse {
  status: string;
  message: string;
  wave_name: string;
  conversion_results: WaveConversionResult[];
  total_participants_assigned: number;
}

export async function convertWaveRegistrationsToParticipants(eventumSlug: string, waveId: number): Promise<WaveConversionResponse> {
  if (shouldUseSubdomainApi()) {
    const { data } = await apiClient.post(`/event-waves/${waveId}/convert_registrations_to_participants/`);
    return data;
  } else if (shouldUseContainerApi()) {
    const { data } = await apiClient.post(`/eventums/${eventumSlug}/event-waves/${waveId}/convert_registrations_to_participants/`);
    return data;
  } else {
    const { data } = await apiClient.post(`/eventums/${eventumSlug}/event-waves/${waveId}/convert_registrations_to_participants/`);
    return data;
  }
}



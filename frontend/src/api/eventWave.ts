import apiClient from './client';

export interface EventWaveEventInfo {
  id: number;
  name: string;
  participant_type: 'all' | 'registration' | 'manual';
  max_participants: number | null;
  registrations_count: number;
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
  const { data } = await apiClient.get(`/eventums/${eventumSlug}/event-waves/`);
  return data;
}

export async function createEventWave(eventumSlug: string, dto: CreateEventWaveDto): Promise<EventWave> {
  const { data } = await apiClient.post(`/eventums/${eventumSlug}/event-waves/`, dto);
  return data;
}

export async function updateEventWave(eventumSlug: string, id: number, dto: UpdateEventWaveDto): Promise<EventWave> {
  const { data } = await apiClient.patch(`/eventums/${eventumSlug}/event-waves/${id}/`, dto);
  return data;
}

export async function deleteEventWave(eventumSlug: string, id: number): Promise<void> {
  await apiClient.delete(`/eventums/${eventumSlug}/event-waves/${id}/`);
}



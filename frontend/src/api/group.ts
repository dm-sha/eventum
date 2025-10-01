import apiClient from './client';
import type { ParticipantGroup } from '../types';
import { shouldUseSubdomainApi, shouldUseContainerApi } from '../utils/eventumSlug';

export const getGroupsForEventum = async (
  eventumSlug: string
): Promise<ParticipantGroup[]> => {
  if (shouldUseSubdomainApi()) {
    // Если мы на поддомене merup.ru в режиме разработки, используем endpoint groups
    const response = await apiClient.get('/groups/');
    return response.data;
  } else if (shouldUseContainerApi()) {
    // Если мы на основном домене контейнера или поддомене merup.ru в продакшене
    const response = await apiClient.get(`/eventums/${eventumSlug}/groups/`);
    return response.data;
  } else {
    // Fallback для других случаев
    const response = await apiClient.get(`/eventums/${eventumSlug}/groups/`);
    return response.data;
  }
};

export const createGroup = async (
  eventumSlug: string,
  data: { name: string; participants: number[]; tag_ids?: number[] }
): Promise<ParticipantGroup> => {
  if (shouldUseSubdomainApi()) {
    const response = await apiClient.post('/groups/', data);
    return response.data;
  } else if (shouldUseContainerApi()) {
    const response = await apiClient.post(`/eventums/${eventumSlug}/groups/`, data);
    return response.data;
  } else {
    const response = await apiClient.post(`/eventums/${eventumSlug}/groups/`, data);
    return response.data;
  }
};

export const updateGroup = async (
  eventumSlug: string,
  groupId: number,
  data: { name?: string; participants?: number[]; tag_ids?: number[] }
): Promise<ParticipantGroup> => {
  if (shouldUseSubdomainApi()) {
    const response = await apiClient.patch(`/groups/${groupId}/`, data);
    return response.data;
  } else if (shouldUseContainerApi()) {
    const response = await apiClient.patch(`/eventums/${eventumSlug}/groups/${groupId}/`, data);
    return response.data;
  } else {
    const response = await apiClient.patch(`/eventums/${eventumSlug}/groups/${groupId}/`, data);
    return response.data;
  }
};

export const deleteGroup = async (
  eventumSlug: string,
  groupId: number
): Promise<void> => {
  if (shouldUseSubdomainApi()) {
    await apiClient.delete(`/groups/${groupId}/`);
  } else if (shouldUseContainerApi()) {
    await apiClient.delete(`/eventums/${eventumSlug}/groups/${groupId}/`);
  } else {
    await apiClient.delete(`/eventums/${eventumSlug}/groups/${groupId}/`);
  }
};


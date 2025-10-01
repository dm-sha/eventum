import apiClient from './client';
import type { ParticipantGroup } from '../types';
import { getSubdomainSlug } from '../utils/eventumSlug';

export const getGroupsForEventum = async (
  eventumSlug: string
): Promise<ParticipantGroup[]> => {
  const subdomainSlug = getSubdomainSlug();
  if (subdomainSlug) {
    const response = await apiClient.get('/groups/');
    return response.data;
  } else {
    const response = await apiClient.get(`/eventums/${eventumSlug}/groups/`);
    return response.data;
  }
};

export const createGroup = async (
  eventumSlug: string,
  data: { name: string; participants: number[]; tag_ids?: number[] }
): Promise<ParticipantGroup> => {
  const subdomainSlug = getSubdomainSlug();
  if (subdomainSlug) {
    const response = await apiClient.post('/groups/', data);
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
  const subdomainSlug = getSubdomainSlug();
  if (subdomainSlug) {
    const response = await apiClient.patch(`/groups/${groupId}/`, data);
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
  const subdomainSlug = getSubdomainSlug();
  if (subdomainSlug) {
    await apiClient.delete(`/groups/${groupId}/`);
  } else {
    await apiClient.delete(`/eventums/${eventumSlug}/groups/${groupId}/`);
  }
};


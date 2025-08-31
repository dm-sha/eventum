import apiClient from './client';
import type { ParticipantGroup } from '../types';

export const getGroupsForEventum = async (
  eventumSlug: string
): Promise<ParticipantGroup[]> => {
  const response = await apiClient.get(`/eventums/${eventumSlug}/groups/`);
  return response.data;
};

export const createGroup = async (
  eventumSlug: string,
  data: { name: string; participants: number[]; tag_ids?: number[] }
): Promise<ParticipantGroup> => {
  const response = await apiClient.post(
    `/eventums/${eventumSlug}/groups/`,
    data
  );
  return response.data;
};


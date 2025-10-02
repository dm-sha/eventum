/**
 * @deprecated Используйте groupsApi из eventumApi.ts
 * Этот файл оставлен для обратной совместимости
 */
import { groupsApi } from './eventumApi';
import type { ParticipantGroup } from '../types';

export const getGroupsForEventum = async (
  eventumSlug: string
): Promise<ParticipantGroup[]> => {
  const response = await groupsApi.getAll(eventumSlug);
  return response.data;
};

export const createGroup = async (
  eventumSlug: string,
  data: { name: string; participants: number[]; tag_ids?: number[] }
): Promise<ParticipantGroup> => {
  const response = await groupsApi.create(data, eventumSlug);
  return response.data;
};

export const updateGroup = async (
  eventumSlug: string,
  groupId: number,
  data: { name?: string; participants?: number[]; tag_ids?: number[] }
): Promise<ParticipantGroup> => {
  const response = await groupsApi.update(groupId, data, eventumSlug);
  return response.data;
};

export const deleteGroup = async (
  eventumSlug: string,
  groupId: number
): Promise<void> => {
  await groupsApi.delete(groupId, eventumSlug);
};


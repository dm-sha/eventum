import type { GroupTag, ParticipantGroup } from '../types';
import apiClient from './client';
import { getSubdomainSlug } from '../utils/eventumSlug';

export const groupTagApi = {
  // Получить все теги групп для конкретного eventum
  getGroupTags: async (eventumSlug: string): Promise<GroupTag[]> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      const response = await apiClient.get('/group-tags/');
      return response.data;
    } else {
      const response = await apiClient.get(`/eventums/${eventumSlug}/group-tags/`);
      return response.data;
    }
  },

  // Создать новый тег группы
  createGroupTag: async (eventumSlug: string, data: { name: string }): Promise<GroupTag> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      const response = await apiClient.post('/group-tags/', data);
      return response.data;
    } else {
      const response = await apiClient.post(`/eventums/${eventumSlug}/group-tags/`, data);
      return response.data;
    }
  },

  // Обновить тег группы
  updateGroupTag: async (
    eventumSlug: string, 
    tagId: number, 
    data: { name: string }
  ): Promise<GroupTag> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      const response = await apiClient.put(`/group-tags/${tagId}/`, data);
      return response.data;
    } else {
      const response = await apiClient.put(`/eventums/${eventumSlug}/group-tags/${tagId}/`, data);
      return response.data;
    }
  },

  // Удалить тег группы
  deleteGroupTag: async (eventumSlug: string, tagId: number): Promise<void> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      await apiClient.delete(`/group-tags/${tagId}/`);
    } else {
      await apiClient.delete(`/eventums/${eventumSlug}/group-tags/${tagId}/`);
    }
  },

  // Получить группы для конкретного тега
  getGroupsForTag: async (eventumSlug: string, tagId: number): Promise<ParticipantGroup[]> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      const response = await apiClient.get(`/group-tags/${tagId}/groups/`);
      return response.data;
    } else {
      const response = await apiClient.get(`/eventums/${eventumSlug}/group-tags/${tagId}/groups/`);
      return response.data;
    }
  },

  // Отвязать группу от тега
  removeGroupFromTag: async (eventumSlug: string, tagId: number, groupId: number): Promise<void> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      await apiClient.delete(`/group-tags/${tagId}/groups/${groupId}/`);
    } else {
      await apiClient.delete(`/eventums/${eventumSlug}/group-tags/${tagId}/groups/${groupId}/`);
    }
  },

  // Привязать группу к тегу
  addGroupToTag: async (eventumSlug: string, tagId: number, groupId: number): Promise<void> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      await apiClient.post(`/group-tags/${tagId}/groups/${groupId}/`);
    } else {
      await apiClient.post(`/eventums/${eventumSlug}/group-tags/${tagId}/groups/${groupId}/`);
    }
  },

  // Получить все группы eventum'а (для выбора при привязке)
  getAllGroups: async (eventumSlug: string): Promise<ParticipantGroup[]> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      const response = await apiClient.get('/groups/');
      return response.data;
    } else {
      const response = await apiClient.get(`/eventums/${eventumSlug}/groups/`);
      return response.data;
    }
  },
};

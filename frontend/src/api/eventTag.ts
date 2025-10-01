import type { EventTag } from '../types';
import apiClient from './client';
import { shouldUseSubdomainApi, shouldUseContainerApi } from '../utils/eventumSlug';

export const eventTagApi = {
  // Получить все теги мероприятий для конкретного eventum
  getEventTags: async (eventumSlug: string): Promise<EventTag[]> => {
    if (shouldUseSubdomainApi()) {
      const response = await apiClient.get('/event-tags/');
      return response.data;
    } else if (shouldUseContainerApi()) {
      const response = await apiClient.get(`/eventums/${eventumSlug}/event-tags/`);
      return response.data;
    } else {
      const response = await apiClient.get(`/eventums/${eventumSlug}/event-tags/`);
      return response.data;
    }
  },

  // Создать новый тег мероприятия
  createEventTag: async (eventumSlug: string, data: { name: string }): Promise<EventTag> => {
    if (shouldUseSubdomainApi()) {
      const response = await apiClient.post('/event-tags/', data);
      return response.data;
    } else if (shouldUseContainerApi()) {
      const response = await apiClient.post(`/eventums/${eventumSlug}/event-tags/`, data);
      return response.data;
    } else {
      const response = await apiClient.post(`/eventums/${eventumSlug}/event-tags/`, data);
      return response.data;
    }
  },

  // Обновить тег мероприятия
  updateEventTag: async (
    eventumSlug: string, 
    tagId: number, 
    data: { name: string }
  ): Promise<EventTag> => {
    if (shouldUseSubdomainApi()) {
      const response = await apiClient.put(`/event-tags/${tagId}/`, data);
      return response.data;
    } else if (shouldUseContainerApi()) {
      const response = await apiClient.put(`/eventums/${eventumSlug}/event-tags/${tagId}/`, data);
      return response.data;
    } else {
      const response = await apiClient.put(`/eventums/${eventumSlug}/event-tags/${tagId}/`, data);
      return response.data;
    }
  },

  // Удалить тег мероприятия
  deleteEventTag: async (eventumSlug: string, tagId: number): Promise<void> => {
    if (shouldUseSubdomainApi()) {
      await apiClient.delete(`/event-tags/${tagId}/`);
    } else if (shouldUseContainerApi()) {
      await apiClient.delete(`/eventums/${eventumSlug}/event-tags/${tagId}/`);
    } else {
      await apiClient.delete(`/eventums/${eventumSlug}/event-tags/${tagId}/`);
    }
  },
};

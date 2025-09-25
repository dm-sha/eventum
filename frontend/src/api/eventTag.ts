import type { EventTag } from '../types';
import apiClient from './client';

export const eventTagApi = {
  // Получить все теги мероприятий для конкретного eventum
  getEventTags: async (eventumSlug: string): Promise<EventTag[]> => {
    const response = await apiClient.get(`/eventums/${eventumSlug}/event-tags/`);
    return response.data;
  },

  // Создать новый тег мероприятия
  createEventTag: async (eventumSlug: string, data: { name: string }): Promise<EventTag> => {
    const response = await apiClient.post(`/eventums/${eventumSlug}/event-tags/`, data);
    return response.data;
  },

  // Обновить тег мероприятия
  updateEventTag: async (
    eventumSlug: string, 
    tagId: number, 
    data: { name: string }
  ): Promise<EventTag> => {
    const response = await apiClient.put(`/eventums/${eventumSlug}/event-tags/${tagId}/`, data);
    return response.data;
  },

  // Удалить тег мероприятия
  deleteEventTag: async (eventumSlug: string, tagId: number): Promise<void> => {
    await apiClient.delete(`/eventums/${eventumSlug}/event-tags/${tagId}/`);
  },
};

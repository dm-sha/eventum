import apiClient from './client';
import type { Event } from '../types';
import { getSubdomainSlug, shouldUseSubdomainApi, shouldUseContainerApi } from '../utils/eventumSlug';

// Получить список всех мероприятий для конкретного Eventum.
export const getEventsForEventum = async (eventumSlug: string): Promise<Event[]> => {
    if (shouldUseSubdomainApi()) {
        // Если мы на поддомене merup.ru в режиме разработки, используем endpoint events
        const response = await apiClient.get('/events/');
        return response.data;
    } else if (shouldUseContainerApi()) {
        // Если мы на основном домене контейнера или поддомене merup.ru в продакшене
        const response = await apiClient.get(`/eventums/${eventumSlug}/events/`);
        return response.data;
    } else {
        // Fallback для других случаев
        const response = await apiClient.get(`/eventums/${eventumSlug}/events/`);
        return response.data;
    }
};


// Создать новое мероприятие
export const createEvent = async (eventumSlug: string, data: {
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  tags?: number[];
  tag_ids?: number[];
  group_tags?: number[];
  group_tag_ids?: number[];
  location_ids?: number[];
}): Promise<Event> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
        const response = await apiClient.post('/events/', data);
        return response.data;
    } else {
        const response = await apiClient.post(`/eventums/${eventumSlug}/events/`, data);
        return response.data;
    }
};

// Обновить мероприятие
export const updateEvent = async (eventumSlug: string, eventId: number, data: {
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  participant_type?: string;
  max_participants?: number;
  participants?: number[];
  groups?: number[];
  tags?: number[];
  tag_ids?: number[];
  group_tags?: number[];
  group_tag_ids?: number[];
  location_ids?: number[];
}): Promise<Event> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
        const response = await apiClient.put(`/events/${eventId}/`, data);
        return response.data;
    } else {
        const response = await apiClient.put(`/eventums/${eventumSlug}/events/${eventId}/`, data);
        return response.data;
    }
};

// Удалить мероприятие
export const deleteEvent = async (eventumSlug: string, eventId: number): Promise<void> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
        await apiClient.delete(`/events/${eventId}/`);
    } else {
        await apiClient.delete(`/eventums/${eventumSlug}/events/${eventId}/`);
    }
};

// Получить eventum'ы пользователя (где он имеет какую-либо роль)
export const getUserEventums = async (): Promise<any[]> => {
    const response = await apiClient.get('/auth/eventums/');
    return response.data;
};

// Получить пользователя разработчика для локального режима
export const getDevUser = async (): Promise<{access: string, refresh: string, user: any}> => {
    const response = await apiClient.get('/auth/dev-user/');
    return response.data;
};

// Записаться на мероприятие
export const registerForEvent = async (eventumSlug: string, eventId: number): Promise<void> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
        await apiClient.post(`/events/${eventId}/register/`);
    } else {
        await apiClient.post(`/eventums/${eventumSlug}/events/${eventId}/register/`);
    }
};

// Отписаться от мероприятия
export const unregisterFromEvent = async (eventumSlug: string, eventId: number): Promise<void> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
        await apiClient.delete(`/events/${eventId}/unregister/`);
    } else {
        await apiClient.delete(`/eventums/${eventumSlug}/events/${eventId}/unregister/`);
    }
};

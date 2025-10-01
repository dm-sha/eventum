import apiClient from './client';
import type { Event } from '../types';
import { getSubdomainSlug } from '../utils/eventumSlug';

// Получить список всех мероприятий для конкретного Eventum.
export const getEventsForEventum = async (eventumSlug: string): Promise<Event[]> => {
    const hostname = window.location.hostname;
    
    // Определяем, куда идет API запрос
    const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:8000/api' : 
        (hostname.endsWith('.merup.ru') ? 'https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api' : 
         import.meta.env.VITE_API_BASE_URL || 'https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api');
    
    // Если API запрос идет к основному домену контейнера, используем slug в пути
    if (apiBaseUrl.includes('bbapo5ibqs4eg6dail89.containers.yandexcloud.net')) {
        const response = await apiClient.get(`/eventums/${eventumSlug}/events/`);
        return response.data;
    }
    // Если API запрос идет к поддомену (локальная разработка), используем endpoint events
    else {
        const response = await apiClient.get('/events/');
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

import apiClient from './client';
import type { Event } from '../types';

// Получить список всех мероприятий для конкретного Eventum.
export const getEventsForEventum = async (eventumSlug: string): Promise<Event[]> => {
    const response = await apiClient.get(`/eventums/${eventumSlug}/events/`);
    return response.data;
};

// Получить список предстоящих мероприятий (используя кастомный action).
export const getUpcomingEvents = async (eventumSlug: string): Promise<Event[]> => {
    const response = await apiClient.get(`/eventums/${eventumSlug}/events/upcoming/`);
    return response.data;
};

// Получить список прошедших мероприятий (используя кастомный action).
export const getPastEvents = async (eventumSlug: string): Promise<Event[]> => {
    const response = await apiClient.get(`/eventums/${eventumSlug}/events/past/`);
    return response.data;
};

// Создать новое мероприятие
export const createEvent = async (eventumSlug: string, data: {
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  tags: number[];
}): Promise<Event> => {
    const response = await apiClient.post(`/eventums/${eventumSlug}/events/`, data);
    return response.data;
};

// Обновить мероприятие
export const updateEvent = async (eventumSlug: string, eventId: number, data: {
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  tags: number[];
}): Promise<Event> => {
    const response = await apiClient.put(`/eventums/${eventumSlug}/events/${eventId}/`, data);
    return response.data;
};

// Удалить мероприятие
export const deleteEvent = async (eventumSlug: string, eventId: number): Promise<void> => {
    await apiClient.delete(`/eventums/${eventumSlug}/events/${eventId}/`);
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

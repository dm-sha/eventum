import apiClient from './client';
import type { Event, UserEvent, CreateEventData } from '../types';

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

// Получить мероприятия пользователя (где он организатор или участник)
export const getUserEvents = async (): Promise<UserEvent[]> => {
    const response = await apiClient.get('/auth/events/');
    return response.data;
};

// Создать новое мероприятие с автоматическим назначением пользователя организатором
export const createEventWithOrganizer = async (eventData: CreateEventData): Promise<UserEvent> => {
    const response = await apiClient.post('/auth/create-event/', eventData);
    return response.data;
};

// Получить пользователя разработчика для локального режима
export const getDevUser = async (): Promise<{access: string, refresh: string, user: any}> => {
    const response = await apiClient.get('/auth/dev-user/');
    return response.data;
};

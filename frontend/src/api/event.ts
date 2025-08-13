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

// Здесь можно добавить createEvent, updateEvent и т.д.

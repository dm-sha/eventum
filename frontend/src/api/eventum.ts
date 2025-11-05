/**
 * @deprecated Используйте eventumApi из eventumApi.ts
 * Этот файл оставлен для обратной совместимости
 */
import { eventumApi } from './eventumApi';
import type { Eventum, EventumDetails } from '../types';

// Функция для получения списка всех Eventum
export const getAllEventums = async (): Promise<Eventum[]> => {
    const response = await eventumApi.getAll();
    return response.data;
};

// Функция для получения одного Eventum по его slug
export const getEventumBySlug = async (slug: string): Promise<Eventum> => {
    const response = await eventumApi.getBySlug(slug);
    return response.data;
};

// Функция для создания нового Eventum
export const createEventum = async (data: { name: string; slug: string }): Promise<Eventum> => {
    const response = await eventumApi.create(data);
    return response.data;
};

// Функция для проверки доступности slug
export const checkSlugAvailability = async (slug: string): Promise<boolean> => {
    try {
        const response = await eventumApi.checkSlugAvailability(slug);
        return response.data.available;
    } catch (error: any) {
        console.error('Ошибка проверки slug:', error);
        throw error;
    }
};

// Функция для получения детальной информации о eventum
export const getEventumDetails = async (slug: string): Promise<EventumDetails> => {
    const response = await eventumApi.getDetails(slug);
    return response.data;
};

// Функция для обновления названия eventum
export const updateEventumName = async (slug: string, name: string): Promise<Eventum> => {
    const response = await eventumApi.update(slug, { name });
    return response.data;
};

// Функция для обновления описания eventum
export const updateEventumDescription = async (slug: string, description: string): Promise<Eventum> => {
    const response = await eventumApi.update(slug, { description });
    return response.data;
};

// Обновить видимость вкладки расписания
export const updateEventumScheduleVisible = async (slug: string, schedule_visible: boolean): Promise<Eventum> => {
    const response = await eventumApi.update(slug, { schedule_visible });
    return response.data;
};

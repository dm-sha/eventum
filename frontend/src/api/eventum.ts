import apiClient from './client';
import type { Eventum } from '../types';

// Функция для получения списка всех Eventum
export const getAllEventums = async (): Promise<Eventum[]> => {
    const response = await apiClient.get<Eventum[]>('/eventums/');
    return response.data;
};

// Функция для получения одного Eventum по его slug
export const getEventumBySlug = async (slug: string): Promise<Eventum> => {
    const response = await apiClient.get<Eventum>(`/eventums/${slug}/`);
    return response.data;
};

// Функция для создания нового Eventum
export const createEventum = async (data: { name: string; slug: string }): Promise<Eventum> => {
    const response = await apiClient.post<Eventum>('/eventums/', data);
    return response.data;
};

// Функция для проверки доступности slug
export const checkSlugAvailability = async (slug: string): Promise<boolean> => {
    try {
        const response = await apiClient.get(`/eventums/check-slug/${slug}/`);
        return response.data.available;
    } catch (error: any) {
        console.error('Ошибка проверки slug:', error);
        throw error;
    }
};

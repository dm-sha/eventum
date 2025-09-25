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

// Функция проверки пароля удалена - больше не нужна

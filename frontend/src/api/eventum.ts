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

// Проверить пароль для Eventum.
export const verifyEventumPassword = async (slug: string, password: string): Promise<{ verified: boolean }> => {
    const response = await apiClient.post(`/eventums/${slug}/verify_password/`, { password });
    return response.data;
};

import apiClient from './client';
import type { UserRole, User } from '../types';

// Функция для получения списка организаторов eventum
export const getEventumOrganizers = async (eventumSlug: string): Promise<UserRole[]> => {
    const response = await apiClient.get<UserRole[]>(`/eventums/${eventumSlug}/organizers/`);
    return response.data;
};

// Функция для добавления организатора
export const addEventumOrganizer = async (eventumSlug: string, userId: number): Promise<UserRole> => {
    const response = await apiClient.post<UserRole>(`/eventums/${eventumSlug}/organizers/`, {
        user_id: userId
    });
    return response.data;
};

// Функция для удаления организатора
export const removeEventumOrganizer = async (eventumSlug: string, roleId: number): Promise<void> => {
    await apiClient.delete(`/eventums/${eventumSlug}/organizers/${roleId}/`);
};

// Функция для поиска пользователей для добавления в организаторы
export const searchUsers = async (query: string): Promise<User[]> => {
    const response = await apiClient.get<User[]>(`/users/search/?q=${encodeURIComponent(query)}`);
    return response.data;
};

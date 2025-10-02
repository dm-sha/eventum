/**
 * @deprecated Используйте organizersApi и usersApi из eventumApi.ts
 * Этот файл оставлен для обратной совместимости
 */
import { organizersApi, usersApi } from './eventumApi';
import type { UserRole, User } from '../types';

// Функция для получения списка организаторов eventum
export const getEventumOrganizers = async (eventumSlug: string): Promise<UserRole[]> => {
    const response = await organizersApi.getAll(eventumSlug);
    return response.data;
};

// Функция для добавления организатора
export const addEventumOrganizer = async (eventumSlug: string, userId: number): Promise<UserRole> => {
    const response = await organizersApi.add(userId, eventumSlug);
    return response.data;
};

// Функция для удаления организатора
export const removeEventumOrganizer = async (eventumSlug: string, roleId: number): Promise<void> => {
    await organizersApi.remove(roleId, eventumSlug);
};

// Функция для поиска пользователей для добавления в организаторы
export const searchUsers = async (query: string): Promise<User[]> => {
    const response = await usersApi.search(query);
    return response.data;
};

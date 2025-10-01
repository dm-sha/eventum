import apiClient from './client';
import type { Eventum, EventumDetails } from '../types';
import { getSubdomainSlug } from '../utils/eventumSlug';

// Функция для получения списка всех Eventum
export const getAllEventums = async (): Promise<Eventum[]> => {
    const response = await apiClient.get<Eventum[]>('/eventums/');
    return response.data;
};

// Функция для получения одного Eventum по его slug
export const getEventumBySlug = async (slug: string): Promise<Eventum> => {
    const hostname = window.location.hostname;
    
    // Определяем, куда идет API запрос
    const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:8000/api' : 
        (hostname.endsWith('.merup.ru') ? 'https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api' : 
         import.meta.env.VITE_API_BASE_URL || 'https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api');
    
    // Если API запрос идет к основному домену контейнера, используем slug в пути
    if (apiBaseUrl.includes('bbapo5ibqs4eg6dail89.containers.yandexcloud.net')) {
        const response = await apiClient.get<Eventum>(`/eventums/${slug}/`);
        return response.data;
    }
    // Если API запрос идет к поддомену (локальная разработка), используем endpoint details
    else {
        const response = await apiClient.get<EventumDetails>('/details/');
        return response.data;
    }
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

// Функция для получения детальной информации о eventum
export const getEventumDetails = async (slug: string): Promise<EventumDetails> => {
    const hostname = window.location.hostname;
    
    // Определяем, куда идет API запрос
    const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:8000/api' : 
        (hostname.endsWith('.merup.ru') ? 'https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api' : 
         import.meta.env.VITE_API_BASE_URL || 'https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api');
    
    // Если API запрос идет к основному домену контейнера, используем slug в пути
    if (apiBaseUrl.includes('bbapo5ibqs4eg6dail89.containers.yandexcloud.net')) {
        const response = await apiClient.get<EventumDetails>(`/eventums/${slug}/details/`);
        return response.data;
    }
    // Если API запрос идет к поддомену (локальная разработка), используем endpoint details
    else {
        const response = await apiClient.get<EventumDetails>('/details/');
        return response.data;
    }
};

// Функция для обновления названия eventum
export const updateEventumName = async (slug: string, name: string): Promise<Eventum> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
        // При работе с поддоменами используем основной router для обновления
        const response = await apiClient.patch<Eventum>('/eventums/', { name });
        return response.data;
    } else {
        const response = await apiClient.patch<Eventum>(`/eventums/${slug}/`, { name });
        return response.data;
    }
};

// Функция для обновления описания eventum
export const updateEventumDescription = async (slug: string, description: string): Promise<Eventum> => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
        // При работе с поддоменами используем основной router для обновления
        const response = await apiClient.patch<Eventum>('/eventums/', { description });
        return response.data;
    } else {
        const response = await apiClient.patch<Eventum>(`/eventums/${slug}/`, { description });
        return response.data;
    }
};

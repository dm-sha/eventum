import apiClient from './client';
import type { Location, CreateLocationData } from '../types';
import { shouldUseSubdomainApi, shouldUseContainerApi } from '../utils/eventumSlug';

// Функция для создания новой локации
export const createLocation = async (eventumSlug: string, data: CreateLocationData): Promise<Location> => {
    if (shouldUseSubdomainApi()) {
        const response = await apiClient.post<Location>('/locations/', data);
        return response.data;
    } else if (shouldUseContainerApi()) {
        const response = await apiClient.post<Location>(`/eventums/${eventumSlug}/locations/`, data);
        return response.data;
    } else {
        const response = await apiClient.post<Location>(`/eventums/${eventumSlug}/locations/`, data);
        return response.data;
    }
};

// Функция для обновления локации
export const updateLocation = async (eventumSlug: string, locationId: number, data: Partial<CreateLocationData>): Promise<Location> => {
    if (shouldUseSubdomainApi()) {
        const response = await apiClient.patch<Location>(`/locations/${locationId}/`, data);
        return response.data;
    } else if (shouldUseContainerApi()) {
        const response = await apiClient.patch<Location>(`/eventums/${eventumSlug}/locations/${locationId}/`, data);
        return response.data;
    } else {
        const response = await apiClient.patch<Location>(`/eventums/${eventumSlug}/locations/${locationId}/`, data);
        return response.data;
    }
};

// Функция для удаления локации
export const deleteLocation = async (eventumSlug: string, locationId: number): Promise<void> => {
    if (shouldUseSubdomainApi()) {
        await apiClient.delete(`/locations/${locationId}/`);
    } else if (shouldUseContainerApi()) {
        await apiClient.delete(`/eventums/${eventumSlug}/locations/${locationId}/`);
    } else {
        await apiClient.delete(`/eventums/${eventumSlug}/locations/${locationId}/`);
    }
};

// Функция для получения валидных родительских локаций
export const getValidParents = async (eventumSlug: string, kind: string, excludeId?: number): Promise<Location[]> => {
    let url: string;
    
    if (shouldUseSubdomainApi()) {
        url = `/locations/valid_parents/?kind=${kind}`;
    } else if (shouldUseContainerApi()) {
        url = `/eventums/${eventumSlug}/locations/valid_parents/?kind=${kind}`;
    } else {
        url = `/eventums/${eventumSlug}/locations/valid_parents/?kind=${kind}`;
    }
    
    if (excludeId) {
        url += `&exclude_id=${excludeId}`;
    }
    
    const response = await apiClient.get<Location[]>(url);
    return response.data;
};

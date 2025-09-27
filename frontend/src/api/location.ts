import apiClient from './client';
import type { Location, CreateLocationData } from '../types';

// Функция для получения всех локаций eventum
export const getLocationsForEventum = async (eventumSlug: string): Promise<Location[]> => {
    const response = await apiClient.get<Location[]>(`/eventums/${eventumSlug}/locations/`);
    return response.data;
};

// Функция для получения дерева локаций
export const getLocationTree = async (eventumSlug: string): Promise<Location[]> => {
    const response = await apiClient.get<Location[]>(`/eventums/${eventumSlug}/locations/tree/`);
    return response.data;
};

// Функция для получения локации по ID
export const getLocationById = async (eventumSlug: string, locationId: number): Promise<Location> => {
    const response = await apiClient.get<Location>(`/eventums/${eventumSlug}/locations/${locationId}/`);
    return response.data;
};

// Функция для создания новой локации
export const createLocation = async (eventumSlug: string, data: CreateLocationData): Promise<Location> => {
    const response = await apiClient.post<Location>(`/eventums/${eventumSlug}/locations/`, data);
    return response.data;
};

// Функция для обновления локации
export const updateLocation = async (eventumSlug: string, locationId: number, data: Partial<CreateLocationData>): Promise<Location> => {
    const response = await apiClient.patch<Location>(`/eventums/${eventumSlug}/locations/${locationId}/`, data);
    return response.data;
};

// Функция для удаления локации
export const deleteLocation = async (eventumSlug: string, locationId: number): Promise<void> => {
    await apiClient.delete(`/eventums/${eventumSlug}/locations/${locationId}/`);
};

// Функция для получения дочерних локаций
export const getLocationChildren = async (eventumSlug: string, locationId: number): Promise<Location[]> => {
    const response = await apiClient.get<Location[]>(`/eventums/${eventumSlug}/locations/${locationId}/children/`);
    return response.data;
};

// Функция для получения локаций по типу
export const getLocationsByKind = async (eventumSlug: string, kind: string): Promise<Location[]> => {
    const response = await apiClient.get<Location[]>(`/eventums/${eventumSlug}/locations/by_kind/?kind=${kind}`);
    return response.data;
};

// Функция для получения валидных родительских локаций
export const getValidParents = async (eventumSlug: string, kind: string, excludeId?: number): Promise<Location[]> => {
    let url = `/eventums/${eventumSlug}/locations/valid_parents/?kind=${kind}`;
    if (excludeId) {
        url += `&exclude_id=${excludeId}`;
    }
    const response = await apiClient.get<Location[]>(url);
    return response.data;
};

import apiClient from './client';
import type { Participant } from '../types';
import { shouldUseSubdomainApi, shouldUseContainerApi } from '../utils/eventumSlug';

// Получить список всех участников для конкретного Eventum. 
export const getParticipantsForEventum = async (eventumSlug: string): Promise<Participant[]> => {
    if (shouldUseSubdomainApi()) {
        // Если мы на поддомене merup.ru в режиме разработки
        const response = await apiClient.get('/participants/');
        return response.data;
    } else if (shouldUseContainerApi()) {
        // Если мы на основном домене контейнера или поддомене merup.ru в продакшене
        const response = await apiClient.get(`/eventums/${eventumSlug}/participants/`);
        return response.data;
    } else {
        // Fallback для других случаев
        const response = await apiClient.get(`/eventums/${eventumSlug}/participants/`);
        return response.data;
    }
};

// Создать нового участника.
export const createParticipant = async (eventumSlug: string, participantData: { 
    name: string; 
    user_id?: number | null; 
}): Promise<Participant> => {
    if (shouldUseSubdomainApi()) {
        const response = await apiClient.post('/participants/', participantData);
        return response.data;
    } else if (shouldUseContainerApi()) {
        const response = await apiClient.post(`/eventums/${eventumSlug}/participants/`, participantData);
        return response.data;
    } else {
        const response = await apiClient.post(`/eventums/${eventumSlug}/participants/`, participantData);
        return response.data;
    }
};

// Обновить участника
export const updateParticipant = async (
    eventumSlug: string, 
    participantId: number, 
    participantData: { 
        name?: string; 
        user_id?: number | null; 
    }
): Promise<Participant> => {
    if (shouldUseSubdomainApi()) {
        const response = await apiClient.patch(`/participants/${participantId}/`, participantData);
        return response.data;
    } else if (shouldUseContainerApi()) {
        const response = await apiClient.patch(`/eventums/${eventumSlug}/participants/${participantId}/`, participantData);
        return response.data;
    } else {
        const response = await apiClient.patch(`/eventums/${eventumSlug}/participants/${participantId}/`, participantData);
        return response.data;
    }
};

// Удалить участника
export const deleteParticipant = async (eventumSlug: string, participantId: number): Promise<void> => {
    if (shouldUseSubdomainApi()) {
        await apiClient.delete(`/participants/${participantId}/`);
    } else if (shouldUseContainerApi()) {
        await apiClient.delete(`/eventums/${eventumSlug}/participants/${participantId}/`);
    } else {
        await apiClient.delete(`/eventums/${eventumSlug}/participants/${participantId}/`);
    }
};

// Получить информацию о текущем участнике для конкретного Eventum
export const getCurrentParticipant = async (eventumSlug: string): Promise<Participant | null> => {
    try {
        if (shouldUseSubdomainApi()) {
            const response = await apiClient.get('/participants/me/');
            return response.data;
        } else if (shouldUseContainerApi()) {
            const response = await apiClient.get(`/eventums/${eventumSlug}/participants/me/`);
            return response.data;
        } else {
            const response = await apiClient.get(`/eventums/${eventumSlug}/participants/me/`);
            return response.data;
        }
    } catch (error: any) {
        if (error.response?.status === 404) {
            // Пользователь не является участником этого eventum
            return null;
        }
        throw error;
    }
};

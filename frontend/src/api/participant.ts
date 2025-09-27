import apiClient from './client';
import type { Participant } from '../types';

// Получить список всех участников для конкретного Eventum. 
export const getParticipantsForEventum = async (eventumSlug: string): Promise<Participant[]> => {
    const response = await apiClient.get(`/eventums/${eventumSlug}/participants/`);
    return response.data;
};

// Создать нового участника.
export const createParticipant = async (eventumSlug: string, participantData: { 
    name: string; 
    user_id?: number; 
}): Promise<Participant> => {
    const response = await apiClient.post(`/eventums/${eventumSlug}/participants/`, participantData);
    return response.data;
};

// Получить участника для текущего пользователя
export const getMyParticipant = async (eventumSlug: string): Promise<Participant> => {
    const response = await apiClient.get(`/eventums/${eventumSlug}/participants/me/`);
    return response.data;
};

// Присоединиться к eventum как участник
export const joinEventum = async (eventumSlug: string): Promise<Participant> => {
    const response = await apiClient.post(`/eventums/${eventumSlug}/participants/join/`);
    return response.data;
};

// Покинуть eventum
export const leaveEventum = async (eventumSlug: string): Promise<void> => {
    await apiClient.delete(`/eventums/${eventumSlug}/participants/leave/`);
};

// Обновить участника
export const updateParticipant = async (
    eventumSlug: string, 
    participantId: number, 
    participantData: { 
        name?: string; 
        user_id?: number; 
    }
): Promise<Participant> => {
    const response = await apiClient.patch(`/eventums/${eventumSlug}/participants/${participantId}/`, participantData);
    return response.data;
};

// Удалить участника
export const deleteParticipant = async (eventumSlug: string, participantId: number): Promise<void> => {
    await apiClient.delete(`/eventums/${eventumSlug}/participants/${participantId}/`);
};

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
    user_id?: number | null; 
}): Promise<Participant> => {
    const response = await apiClient.post(`/eventums/${eventumSlug}/participants/`, participantData);
    return response.data;
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
    const response = await apiClient.patch(`/eventums/${eventumSlug}/participants/${participantId}/`, participantData);
    return response.data;
};

// Удалить участника
export const deleteParticipant = async (eventumSlug: string, participantId: number): Promise<void> => {
    await apiClient.delete(`/eventums/${eventumSlug}/participants/${participantId}/`);
};

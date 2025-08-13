import apiClient from './client';
import type { Participant } from '../types';

//Получить список всех участников для конкретного Eventum. 
export const getParticipantsForEventum = async (eventumSlug: string): Promise<Participant[]> => {
    const response = await apiClient.get(`/eventums/${eventumSlug}/participants/`);
    return response.data;
};

// Создать нового участника.
// (Пример для будущих CRUD операций)
export const createParticipant = async (eventumSlug: string, participantData: { name: string }): Promise<Participant> => {
    const response = await apiClient.post(`/eventums/${eventumSlug}/participants/`, participantData);
    return response.data;
};

// Здесь можно добавить updateParticipant, deleteParticipant и т.д.

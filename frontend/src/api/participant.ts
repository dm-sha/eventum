/**
 * @deprecated Используйте participantsApi из eventumApi.ts
 * Этот файл оставлен для обратной совместимости
 */
import { participantsApi } from './eventumApi';
import type { Participant, EventRegistration } from '../types';

// Получить список всех участников для конкретного Eventum. 
export const getParticipantsForEventum = async (eventumSlug: string): Promise<Participant[]> => {
    const response = await participantsApi.getAll(eventumSlug);
    return response.data;
};

// Создать нового участника.
export const createParticipant = async (eventumSlug: string, participantData: { 
    name: string; 
    user_id?: number | null; 
}): Promise<Participant> => {
    const data = {
        name: participantData.name,
        user_id: participantData.user_id
    };
    const response = await participantsApi.create(data, eventumSlug);
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
    const data = {
        name: participantData.name,
        user_id: participantData.user_id
    };
    const response = await participantsApi.update(participantId, data, eventumSlug);
    return response.data;
};

// Удалить участника
export const deleteParticipant = async (eventumSlug: string, participantId: number): Promise<void> => {
    await participantsApi.delete(participantId, eventumSlug);
};

// Получить информацию о текущем участнике для конкретного Eventum
export const getCurrentParticipant = async (eventumSlug: string): Promise<Participant | null> => {
    try {
        const response = await participantsApi.getCurrent(eventumSlug);
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            // Пользователь не является участником этого eventum
            return null;
        }
        throw error;
    }
};

// Получить заявки текущего участника на мероприятия
export const getMyRegistrations = async (eventumSlug: string): Promise<EventRegistration[]> => {
    const response = await participantsApi.getMyRegistrations(eventumSlug);
    return response.data;
};

/**
 * @deprecated Используйте eventsApi и authApi из eventumApi.ts
 * Этот файл оставлен для обратной совместимости
 */
import { eventsApi, authApi } from './eventumApi';
import type { Event } from '../types';

// Получить список всех мероприятий для конкретного Eventum.
export const getEventsForEventum = async (eventumSlug: string, options?: { participant?: number }): Promise<Event[]> => {
    const response = await eventsApi.getAll(eventumSlug, options);
    return response.data;
};

// Создать новое мероприятие
export const createEvent = async (eventumSlug: string, data: {
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  tags?: number[];
  tag_ids?: number[];
  location_ids?: number[];
}): Promise<Event> => {
    const response = await eventsApi.create(data as any, eventumSlug);
    return response.data;
};

// Обновить мероприятие
export const updateEvent = async (eventumSlug: string, eventId: number, data: {
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  participants?: number[];
  groups?: number[];
  tags?: number[];
  tag_ids?: number[];
  location_ids?: number[];
  event_group_v2_id?: number | null;
}): Promise<Event> => {
    const response = await eventsApi.update(eventId, data as any, eventumSlug);
    return response.data;
};

// Удалить мероприятие
export const deleteEvent = async (eventumSlug: string, eventId: number): Promise<void> => {
    await eventsApi.delete(eventId, eventumSlug);
};

// Получить eventum'ы пользователя (где он имеет какую-либо роль)
export const getUserEventums = async (): Promise<any[]> => {
    const response = await authApi.getUserEventums();
    return response.data;
};

// Получить пользователя разработчика для локального режима
export const getDevUser = async (): Promise<{access: string, refresh: string, user: any}> => {
    const response = await authApi.getDevUser();
    return response.data;
};

// Подать заявку на мероприятие
export const registerForEvent = async (eventumSlug: string, eventId: number): Promise<void> => {
    await eventsApi.register(eventId, eventumSlug);
};

// Отменить заявку на мероприятие
export const unregisterFromEvent = async (eventumSlug: string, eventId: number): Promise<void> => {
    await eventsApi.unregister(eventId, eventumSlug);
};

// Скачать календарь мероприятий участника в формате iCalendar
export const downloadParticipantCalendar = async (eventumSlug: string, participantId: number): Promise<void> => {
    const { apiClient } = await import('./client');
    const { resolveApiBaseUrl } = await import('./baseUrl');
    
    try {
        // Для Safari на iPad используем прямой переход на URL вместо blob
        // Это более надежно, так как программные клики блокируются
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        if (isIOS) {
            // Для iOS используем прямой переход на серверный URL
            // Safari на iOS требует, чтобы скачивание происходило в контексте пользовательского действия
            const baseURL = resolveApiBaseUrl();
            const cleanBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
            const url = `${cleanBaseURL}/eventums/${eventumSlug}/calendar/${participantId}.ics`;
            
            // Пробуем использовать window.open, который может работать лучше на iPhone
            const opened = window.open(url, '_blank');
            if (!opened) {
                // Если window.open заблокирован, используем прямой переход
                // Это должно работать, так как происходит в контексте пользовательского клика
                window.location.href = url;
            }
        } else {
            // Для других браузеров используем blob URL
            const response = await apiClient.get(`/eventums/${eventumSlug}/calendar/${participantId}.ics`, {
                responseType: 'blob',
            });
            
            // Создаем ссылку для скачивания
            const blob = new Blob([response.data], { type: 'text/calendar' });
            const url = window.URL.createObjectURL(blob);
            
            // Пробуем использовать window.open для лучшей совместимости
            const opened = window.open(url, '_blank');
            if (!opened) {
                // Если window.open заблокирован, используем прямой переход
                window.location.href = url;
            }
            
            // Очищаем URL через некоторое время
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 100);
        }
    } catch (error) {
        console.error('Ошибка при скачивании календаря:', error);
        throw error;
    }
};

// Получить webcal ссылку для подписки на календарь участника
export const getParticipantCalendarWebcalUrl = async (eventumSlug: string, participantId: number): Promise<{
    webcal_url: string;
    calendar_name: string;
    description: string;
}> => {
    const { apiClient } = await import('./client');
    
    try {
        const response = await apiClient.get(`/eventums/${eventumSlug}/calendar/webcal?participant_id=${participantId}`);
        return response.data;
    } catch (error) {
        console.error('Ошибка при получении webcal ссылки:', error);
        throw error;
    }
};

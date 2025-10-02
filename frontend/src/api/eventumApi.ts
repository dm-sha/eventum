/**
 * Упрощенный API для работы с eventum
 */
import { createApiRequest } from './apiClient';
import { getSubdomainSlug } from '../utils/apiUtils';
import type { 
  Eventum, 
  EventumDetails, 
  Participant, 
  ParticipantGroup, 
  Event, 
  UserRole, 
  User 
} from '../types';

// Базовая функция для определения eventumSlug
const getEventumSlugForRequest = (providedSlug?: string): string | undefined => {
  return getSubdomainSlug() || providedSlug;
};

// ============= EVENTUM API =============

export const eventumApi = {
  // Получить все eventum'ы
  getAll: () => createApiRequest<Eventum[]>('GET', '/eventums/'),
  
  // Получить eventum по slug
  getBySlug: (slug: string) => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      return createApiRequest<EventumDetails>('GET', '/details/');
    }
    return createApiRequest<Eventum>('GET', `/eventums/${slug}/`);
  },
  
  // Создать новый eventum
  create: (data: { name: string; slug: string }) => 
    createApiRequest<Eventum>('POST', '/eventums/', undefined, data),
  
  // Обновить eventum
  update: (slug: string, data: Partial<Eventum>) => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      return createApiRequest<Eventum>('PATCH', '/eventums/', undefined, data);
    }
    return createApiRequest<Eventum>('PATCH', `/eventums/${slug}/`, undefined, data);
  },
  
  // Проверить доступность slug
  checkSlugAvailability: (slug: string) => 
    createApiRequest<{ available: boolean }>('GET', `/eventums/check-slug/${slug}/`),
  
  // Получить детальную информацию
  getDetails: (slug: string) => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      return createApiRequest<EventumDetails>('GET', '/details/');
    }
    return createApiRequest<EventumDetails>('GET', `/eventums/${slug}/details/`);
  }
};

// ============= PARTICIPANTS API =============

export const participantsApi = {
  // Получить всех участников
  getAll: (eventumSlug?: string) => 
    createApiRequest<Participant[]>('GET', '/participants/', getEventumSlugForRequest(eventumSlug)),
  
  // Создать участника
  create: (data: { name: string; user_id?: number }, eventumSlug?: string) => 
    createApiRequest<Participant>('POST', '/participants/', getEventumSlugForRequest(eventumSlug), data),
  
  // Обновить участника
  update: (id: number, data: Partial<Participant>, eventumSlug?: string) => 
    createApiRequest<Participant>('PATCH', `/participants/${id}/`, getEventumSlugForRequest(eventumSlug), data),
  
  // Удалить участника
  delete: (id: number, eventumSlug?: string) => 
    createApiRequest<void>('DELETE', `/participants/${id}/`, getEventumSlugForRequest(eventumSlug)),
  
  // Получить текущего участника
  getCurrent: (eventumSlug?: string) => 
    createApiRequest<Participant>('GET', '/participants/me/', getEventumSlugForRequest(eventumSlug)),
  
  // Присоединиться к eventum
  join: (eventumSlug?: string) => 
    createApiRequest<Participant>('POST', '/participants/join/', getEventumSlugForRequest(eventumSlug)),
  
  // Покинуть eventum
  leave: (eventumSlug?: string) => 
    createApiRequest<void>('DELETE', '/participants/leave/', getEventumSlugForRequest(eventumSlug))
};

// ============= GROUPS API =============

export const groupsApi = {
  // Получить все группы
  getAll: (eventumSlug?: string) => 
    createApiRequest<ParticipantGroup[]>('GET', '/groups/', getEventumSlugForRequest(eventumSlug)),
  
  // Создать группу
  create: (data: { name: string; participants: number[]; tag_ids?: number[] }, eventumSlug?: string) => 
    createApiRequest<ParticipantGroup>('POST', '/groups/', getEventumSlugForRequest(eventumSlug), data),
  
  // Обновить группу
  update: (id: number, data: Partial<ParticipantGroup>, eventumSlug?: string) => 
    createApiRequest<ParticipantGroup>('PATCH', `/groups/${id}/`, getEventumSlugForRequest(eventumSlug), data),
  
  // Удалить группу
  delete: (id: number, eventumSlug?: string) => 
    createApiRequest<void>('DELETE', `/groups/${id}/`, getEventumSlugForRequest(eventumSlug))
};

// ============= EVENTS API =============

export const eventsApi = {
  // Получить все события
  getAll: (eventumSlug?: string) => 
    createApiRequest<Event[]>('GET', '/events/', getEventumSlugForRequest(eventumSlug)),
  
  // Создать событие
  create: (data: Partial<Event>, eventumSlug?: string) => 
    createApiRequest<Event>('POST', '/events/', getEventumSlugForRequest(eventumSlug), data),
  
  // Обновить событие
  update: (id: number, data: Partial<Event>, eventumSlug?: string) => 
    createApiRequest<Event>('PUT', `/events/${id}/`, getEventumSlugForRequest(eventumSlug), data),
  
  // Удалить событие
  delete: (id: number, eventumSlug?: string) => 
    createApiRequest<void>('DELETE', `/events/${id}/`, getEventumSlugForRequest(eventumSlug)),
  
  // Записаться на событие
  register: (id: number, eventumSlug?: string) => 
    createApiRequest<void>('POST', `/events/${id}/register/`, getEventumSlugForRequest(eventumSlug)),
  
  // Отписаться от события
  unregister: (id: number, eventumSlug?: string) => 
    createApiRequest<void>('DELETE', `/events/${id}/unregister/`, getEventumSlugForRequest(eventumSlug))
};

// ============= ORGANIZERS API =============

export const organizersApi = {
  // Получить организаторов
  getAll: (eventumSlug?: string) => {
    const slug = getEventumSlugForRequest(eventumSlug);
    if (getSubdomainSlug()) {
      return createApiRequest<UserRole[]>('GET', '/organizers/');
    }
    return createApiRequest<UserRole[]>('GET', `/eventums/${slug}/organizers/`);
  },
  
  // Добавить организатора
  add: (userId: number, eventumSlug?: string) => {
    const slug = getEventumSlugForRequest(eventumSlug);
    const data = { user_id: userId };
    if (getSubdomainSlug()) {
      return createApiRequest<UserRole>('POST', '/organizers/', undefined, data);
    }
    return createApiRequest<UserRole>('POST', `/eventums/${slug}/organizers/`, undefined, data);
  },
  
  // Удалить организатора
  remove: (roleId: number, eventumSlug?: string) => {
    const slug = getEventumSlugForRequest(eventumSlug);
    if (getSubdomainSlug()) {
      return createApiRequest<void>('DELETE', `/organizers/${roleId}/`);
    }
    return createApiRequest<void>('DELETE', `/eventums/${slug}/organizers/${roleId}/`);
  }
};

// ============= USERS API =============

export const usersApi = {
  // Поиск пользователей
  search: (query: string) => 
    createApiRequest<User[]>('GET', `/users/search/?q=${encodeURIComponent(query)}`)
};

// ============= AUTH API =============

export const authApi = {
  // VK авторизация
  vkAuth: (data: { code: string; state?: string }) => 
    createApiRequest<{ access: string; refresh: string; user: User }>('POST', '/auth/vk/', undefined, data),
  
  // Обновление токена
  refreshToken: (data: { refresh: string }) => 
    createApiRequest<{ access: string }>('POST', '/auth/refresh/', undefined, data),
  
  // Получение профиля
  getProfile: () => 
    createApiRequest<User>('GET', '/auth/profile/'),
  
  // Получение ролей
  getRoles: () => 
    createApiRequest<UserRole[]>('GET', '/auth/roles/'),
  
  // Получение eventum'ов пользователя
  getUserEventums: () => 
    createApiRequest<any[]>('GET', '/auth/eventums/'),
  
  // Получение dev пользователя (для разработки)
  getDevUser: () => 
    createApiRequest<{ access: string; refresh: string; user: User }>('GET', '/auth/dev-user/')
};

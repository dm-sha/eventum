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
const getEventumSlugForRequest = (providedSlug?: string): string => {
  const slug = getSubdomainSlug() || providedSlug;

  if (!slug) {
    throw new Error('Eventum slug is required for eventum-scoped API requests');
  }

  return slug;
};

// ============= EVENTUM API =============

export const eventumApi = {
  // Получить все eventum'ы
  getAll: () => createApiRequest<Eventum[]>('GET', '/eventums/'),
  
  // Получить eventum по slug
  getBySlug: (slug: string) => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      return createApiRequest<EventumDetails>('GET', '/details/', subdomainSlug);
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
      return createApiRequest<Eventum>('PATCH', '/', subdomainSlug, data);
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
      return createApiRequest<EventumDetails>('GET', '/details/', subdomainSlug);
    }
    return createApiRequest<EventumDetails>('GET', `/eventums/${slug}/details/`);
  },
  
  // Получить статистику регистраций
  getRegistrationStats: (slug: string) => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      return createApiRequest<{
        registered_participants_count: number;
      }>('GET', '/registration-stats/', subdomainSlug);
    }
    return createApiRequest<{
      registered_participants_count: number;
    }>('GET', `/eventums/${slug}/registration-stats/`);
  },
  
  // Переключить состояние регистрации
  toggleRegistration: (slug: string) => {
    const subdomainSlug = getSubdomainSlug();
    if (subdomainSlug) {
      return createApiRequest<Eventum>('POST', '/toggle_registration/', subdomainSlug);
    }
    return createApiRequest<Eventum>('POST', `/eventums/${slug}/toggle_registration/`);
  }
};

// ============= PARTICIPANTS API =============

export const participantsApi = {
  // Получить всех участников
  getAll: (eventumSlug?: string) => 
    createApiRequest<Participant[]>('GET', '/participants/', getEventumSlugForRequest(eventumSlug)),
  
  // Создать участника
  create: (data: { name: string; user_id?: number | null }, eventumSlug?: string) => 
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
  
  // Подать заявку на событие
  register: (id: number, eventumSlug?: string) => 
    createApiRequest<void>('POST', `/events/${id}/register/`, getEventumSlugForRequest(eventumSlug)),
  
  // Отменить заявку на событие
  unregister: (id: number, eventumSlug?: string) => 
    createApiRequest<void>('DELETE', `/events/${id}/unregister/`, getEventumSlugForRequest(eventumSlug))
};

// ============= ORGANIZERS API =============

export const organizersApi = {
  // Получить организаторов
  getAll: (eventumSlug?: string) => 
    createApiRequest<UserRole[]>('GET', '/organizers/', getEventumSlugForRequest(eventumSlug)),
  
  // Добавить организатора
  add: (userId: number, eventumSlug?: string) => {
    const data = { user_id: userId };
    return createApiRequest<UserRole>('POST', '/organizers/', getEventumSlugForRequest(eventumSlug), data);
  },
  
  // Удалить организатора
  remove: (roleId: number, eventumSlug?: string) => 
    createApiRequest<void>('DELETE', `/organizers/${roleId}/`, getEventumSlugForRequest(eventumSlug))
};

// ============= USERS API =============

export const usersApi = {
  // Поиск пользователей
  search: (query: string) => 
    createApiRequest<User[]>('GET', `/users/search/?q=${encodeURIComponent(query)}`),
  
  // Создать пользователя
  create: (data: { name: string; vk_id: number }) => 
    createApiRequest<User>('POST', '/users/', undefined, data)
};

// ============= EVENT TAGS API =============

export const eventTagsApi = {
  // Получить все теги мероприятий
  getAll: (eventumSlug?: string) => 
    createApiRequest<any[]>('GET', '/event-tags/', getEventumSlugForRequest(eventumSlug)),
  
  // Создать тег мероприятия
  create: (data: { name: string }, eventumSlug?: string) => 
    createApiRequest<any>('POST', '/event-tags/', getEventumSlugForRequest(eventumSlug), data),
  
  // Обновить тег мероприятия
  update: (id: number, data: { name: string }, eventumSlug?: string) => 
    createApiRequest<any>('PUT', `/event-tags/${id}/`, getEventumSlugForRequest(eventumSlug), data),
  
  // Удалить тег мероприятия
  delete: (id: number, eventumSlug?: string) => 
    createApiRequest<void>('DELETE', `/event-tags/${id}/`, getEventumSlugForRequest(eventumSlug))
};

// ============= GROUP TAGS API =============

export const groupTagsApi = {
  // Получить все теги групп
  getAll: (eventumSlug?: string) => 
    createApiRequest<any[]>('GET', '/group-tags/', getEventumSlugForRequest(eventumSlug)),
  
  // Создать тег группы
  create: (data: { name: string }, eventumSlug?: string) => 
    createApiRequest<any>('POST', '/group-tags/', getEventumSlugForRequest(eventumSlug), data),
  
  // Обновить тег группы
  update: (id: number, data: { name: string }, eventumSlug?: string) => 
    createApiRequest<any>('PUT', `/group-tags/${id}/`, getEventumSlugForRequest(eventumSlug), data),
  
  // Удалить тег группы
  delete: (id: number, eventumSlug?: string) => 
    createApiRequest<void>('DELETE', `/group-tags/${id}/`, getEventumSlugForRequest(eventumSlug)),
  
  // Получить группы для тега
  getGroups: (id: number, eventumSlug?: string) => 
    createApiRequest<any[]>('GET', `/group-tags/${id}/groups/`, getEventumSlugForRequest(eventumSlug)),
  
  // Отвязать группу от тега
  removeGroup: (tagId: number, groupId: number, eventumSlug?: string) => 
    createApiRequest<void>('DELETE', `/group-tags/${tagId}/groups/${groupId}/`, getEventumSlugForRequest(eventumSlug)),
  
  // Привязать группу к тегу
  addGroup: (tagId: number, groupId: number, eventumSlug?: string) => 
    createApiRequest<void>('POST', `/group-tags/${tagId}/groups/${groupId}/`, getEventumSlugForRequest(eventumSlug))
};

// ============= LOCATIONS API =============

export const locationsApi = {
  // Получить все локации
  getAll: (eventumSlug?: string) => 
    createApiRequest<any[]>('GET', '/locations/', getEventumSlugForRequest(eventumSlug)),
  
  // Получить дерево локаций
  getTree: (eventumSlug?: string) => 
    createApiRequest<any[]>('GET', '/locations/tree/', getEventumSlugForRequest(eventumSlug)),
  
  // Получить локацию по ID
  getById: (id: number, eventumSlug?: string) => 
    createApiRequest<any>('GET', `/locations/${id}/`, getEventumSlugForRequest(eventumSlug)),
  
  // Создать локацию
  create: (data: any, eventumSlug?: string) => 
    createApiRequest<any>('POST', '/locations/', getEventumSlugForRequest(eventumSlug), data),
  
  // Обновить локацию
  update: (id: number, data: any, eventumSlug?: string) => 
    createApiRequest<any>('PATCH', `/locations/${id}/`, getEventumSlugForRequest(eventumSlug), data),
  
  // Удалить локацию
  delete: (id: number, eventumSlug?: string) => 
    createApiRequest<void>('DELETE', `/locations/${id}/`, getEventumSlugForRequest(eventumSlug)),
  
  // Получить дочерние локации
  getChildren: (id: number, eventumSlug?: string) => 
    createApiRequest<any[]>('GET', `/locations/${id}/children/`, getEventumSlugForRequest(eventumSlug)),
  
  // Получить локации по типу
  getByKind: (kind: string, eventumSlug?: string) => 
    createApiRequest<any[]>('GET', `/locations/by_kind/?kind=${kind}`, getEventumSlugForRequest(eventumSlug)),
  
  // Получить валидных родителей
  getValidParents: (kind: string, excludeId?: number, eventumSlug?: string) => {
    const params = excludeId ? `kind=${kind}&exclude_id=${excludeId}` : `kind=${kind}`;
    return createApiRequest<any[]>('GET', `/locations/valid_parents/?${params}`, getEventumSlugForRequest(eventumSlug));
  }
};

// ============= EVENT WAVES API =============

export const eventWavesApi = {
  // Получить все волны
  getAll: (eventumSlug?: string) => 
    createApiRequest<any[]>('GET', '/event-waves/', getEventumSlugForRequest(eventumSlug)),
  
  // Создать волну
  create: (data: any, eventumSlug?: string) => 
    createApiRequest<any>('POST', '/event-waves/', getEventumSlugForRequest(eventumSlug), data),
  
  // Обновить волну
  update: (id: number, data: any, eventumSlug?: string) => 
    createApiRequest<any>('PUT', `/event-waves/${id}/`, getEventumSlugForRequest(eventumSlug), data),
  
  // Удалить волну
  delete: (id: number, eventumSlug?: string) => 
    createApiRequest<void>('DELETE', `/event-waves/${id}/`, getEventumSlugForRequest(eventumSlug))
};

// ============= AUTH API =============

export const authApi = {
  // VK авторизация
  vkAuth: (data: { code: string; state?: string }) => 
    createApiRequest<{ access: string; refresh: string; user: User }>('POST', '/auth/vk/', undefined, data),
  
  // Обновление токена
  refreshToken: (data: { refresh: string }) => 
    createApiRequest<{ access: string; refresh?: string }>('POST', '/auth/refresh/', undefined, data),
  
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

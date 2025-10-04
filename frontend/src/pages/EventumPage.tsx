import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getEventumBySlug } from "../api/eventum";
import { listEventWaves } from "../api/eventWave";
import { getEventsForEventum, registerForEvent, unregisterFromEvent } from "../api/event";
import { getCurrentParticipant } from "../api/participant";
import { authApi } from "../api/eventumApi";
import type { Eventum, Event, Participant, UserRole } from "../types";
import type { EventWave } from "../api/eventWave";
import LoadingSpinner from "../components/LoadingSpinner";
import { useEventumSlug } from "../hooks/useEventumSlug";
import { getEventumScopedPath } from "../utils/eventumSlug";

const EventumPage = () => {
  const eventumSlug = useEventumSlug();
  const location = useLocation();
  const navigate = useNavigate();
  const [eventum, setEventum] = useState<Eventum | null>(null);
  const [eventWaves, setEventWaves] = useState<EventWave[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Определяем текущую вкладку из URL
  const currentTab = location.pathname.split('/').pop() || 'general';

  // Функция для проверки, является ли пользователь организатором данного eventum
  const isUserOrganizer = (eventumId: number): boolean => {
    return userRoles.some(role => 
      role.eventum === eventumId && role.role === 'organizer'
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!eventumSlug) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Загружаем основные данные параллельно (кроме участника)
        const [eventumData, wavesData, eventsData, rolesData] = await Promise.all([
          getEventumBySlug(eventumSlug),
          listEventWaves(eventumSlug),
          getEventsForEventum(eventumSlug),
          authApi.getRoles()
        ]);
        
        // Загружаем данные участника отдельно, чтобы 404 не ломал всю страницу
        let participantData = null;
        try {
          participantData = await getCurrentParticipant(eventumSlug);
        } catch (participantErr: unknown) {
          // Если пользователь не является участником (404), это нормально
          const error = participantErr as { response?: { status?: number } };
          if (error?.response?.status !== 404) {
            console.error('Ошибка загрузки данных участника:', participantErr);
          }
        }
        
        setEventum(eventumData);
        setEventWaves(wavesData);
        setEvents(eventsData);
        setCurrentParticipant(participantData);
        setUserRoles(rolesData.data);
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        setError('Не удалось загрузить информацию о событии');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventumSlug]);

  const handleTabChange = (tab: string) => {
    if (!eventumSlug) return;
    navigate(getEventumScopedPath(eventumSlug, `/${tab}`));
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-center">
          <LoadingSpinner />
        </div>
      </main>
    );
  }

  if (error || !eventum) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {error || 'Событие не найдено'}
            </h1>
            <a
              href="https://merup.ru/"
              className="inline-flex items-center justify-center rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Вернуться на главную
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {/* Заголовок */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              {eventum.name}
            </h1>
          </div>
          {isUserOrganizer(eventum.id) && (
            <Link
              to={eventumSlug ? getEventumScopedPath(eventumSlug, "/admin") : "/"}
              className="inline-flex items-center justify-center rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Админка
            </Link>
          )}
        </div>

        {/* Вкладки */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => handleTabChange('general')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                currentTab === 'general'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Общее
            </button>
            <button
              onClick={() => handleTabChange('registration')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                currentTab === 'registration'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Подача заявок на мероприятия
            </button>
          </nav>
        </div>

        {/* Контент вкладок */}
        <div>
          {currentTab === 'general' && (
            <GeneralTab eventum={eventum} />
          )}
          {currentTab === 'registration' && eventumSlug && (
            <RegistrationTab eventWaves={eventWaves} events={events} currentParticipant={currentParticipant} eventumSlug={eventumSlug} />
          )}
        </div>
      </div>
    </main>
  );
};

// Компонент для вкладки "Общее"
const GeneralTab: React.FC<{ eventum: Eventum }> = ({ eventum }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {eventum.name}
        </h2>
        {eventum.image_url && (
          <div className="mb-6">
            <img
              src={eventum.image_url}
              alt={eventum.name}
              className="w-full max-w-2xl h-auto rounded-lg shadow-sm"
            />
          </div>
        )}
        {eventum.description && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Описание</h3>
            <p className="text-gray-600 whitespace-pre-wrap">{eventum.description}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Компонент для вкладки "Подача заявок на мероприятия"
const RegistrationTab: React.FC<{ eventWaves: EventWave[]; events: Event[]; currentParticipant: Participant | null; eventumSlug: string }> = ({ eventWaves, events, currentParticipant, eventumSlug }) => {
  const [expandedWaves, setExpandedWaves] = useState<Set<number>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [localEvents, setLocalEvents] = useState<Event[]>(events);

  // Обновляем локальное состояние при изменении props
  useEffect(() => {
    setLocalEvents(events);
  }, [events]);

  useEffect(() => {
    const handleRegistrationChange = async () => {
      // Перезагружаем данные с сервера для получения актуального registrations_count
      try {
        const updatedEvents = await getEventsForEventum(eventumSlug);
        setLocalEvents(updatedEvents);
        setRefreshKey(prev => prev + 1);
      } catch (error) {
        console.error('Ошибка обновления данных:', error);
        // Если не удалось загрузить с сервера, просто перерендериваем
        setRefreshKey(prev => prev + 1);
      }
    };

    window.addEventListener('eventRegistrationChanged', handleRegistrationChange);
    return () => {
      window.removeEventListener('eventRegistrationChanged', handleRegistrationChange);
    };
  }, [eventumSlug]);

  const toggleWave = (waveId: number) => {
    const newExpanded = new Set(expandedWaves);
    if (newExpanded.has(waveId)) {
      newExpanded.delete(waveId);
    } else {
      newExpanded.add(waveId);
    }
    setExpandedWaves(newExpanded);
  };

  const getEventsForWave = (wave: EventWave) => {
    return localEvents.filter(event => 
      event.tags.some(tag => tag.id === wave.tag.id)
    );
  };

  const getRegisteredEventsCountForWave = (wave: EventWave) => {
    if (!currentParticipant) return 0;
    const waveEvents = getEventsForWave(wave);
    return waveEvents.filter(event => event.is_registered).length;
  };

  // Проверяем доступность волны для текущего участника
  const isWaveAccessible = (wave: EventWave) => {
    if (!currentParticipant) {
      return { accessible: false, reason: 'Вы не являетесь участником этого события' };
    }

    const participantGroupIds = currentParticipant.groups?.map(g => g.id) || [];
    const participantGroupTagIds = currentParticipant.groups?.flatMap(g => g.tags?.map(t => t.id) || []) || [];

    // Проверяем whitelist групп
    if (wave.whitelist_groups.length > 0) {
      const hasWhitelistedGroup = wave.whitelist_groups.some(group => 
        participantGroupIds.includes(group.id)
      );
      if (!hasWhitelistedGroup) {
        return { 
          accessible: false, 
          reason: `Доступна только для: ${wave.whitelist_groups.map(g => g.name).join(', ')}` 
        };
      }
    }

    // Проверяем whitelist тегов групп
    if (wave.whitelist_group_tags.length > 0) {
      const hasWhitelistedTag = wave.whitelist_group_tags.some(tag => 
        participantGroupTagIds.includes(tag.id)
      );
      if (!hasWhitelistedTag) {
        return { 
          accessible: false, 
          reason: `Доступна только для: ${wave.whitelist_group_tags.map(t => t.name).join(', ')}` 
        };
      }
    }

    // Проверяем blacklist групп
    if (wave.blacklist_groups.length > 0) {
      const hasBlacklistedGroup = wave.blacklist_groups.some(group => 
        participantGroupIds.includes(group.id)
      );
      if (hasBlacklistedGroup) {
        return { 
          accessible: false, 
          reason: `Недоступна для: ${wave.blacklist_groups.map(g => g.name).join(', ')}` 
        };
      }
    }

    // Проверяем blacklist тегов групп
    if (wave.blacklist_group_tags.length > 0) {
      const hasBlacklistedTag = wave.blacklist_group_tags.some(tag => 
        participantGroupTagIds.includes(tag.id)
      );
      if (hasBlacklistedTag) {
        return { 
          accessible: false, 
          reason: `Недоступна для: ${wave.blacklist_group_tags.map(t => t.name).join(', ')}` 
        };
      }
    }

    return { accessible: true, reason: '' };
  };

  // Если пользователь не является участником
  if (!currentParticipant) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <svg
            className="h-8 w-8 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Вы не являетесь участником</h3>
        <p className="mt-2 text-gray-600">
          Чтобы записываться на мероприятия, вам нужно стать участником этого события. 
          Обратитесь к организаторам для получения доступа.
        </p>
      </div>
    );
  }

  // Фильтруем только доступные волны и сортируем по названию
  const accessibleWaves = eventWaves
    .filter(wave => isWaveAccessible(wave).accessible)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  if (accessibleWaves.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-8 w-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Нет доступных волн мероприятий</h3>
        <p className="mt-2 text-gray-600">
          {eventWaves.length === 0 
            ? 'Волны мероприятий пока не созданы организаторами.'
            : 'Нет доступных волн мероприятий.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 sm:space-y-4" key={refreshKey}>
      <h2 className="text-xl font-semibold text-gray-900 mb-2 sm:mb-6">Волны мероприятий</h2>
      <p className="text-gray-600 mb-1 sm:mb-4">
        В одной волне проходит несколько событий одновременно, попасть можно максимум на одно. Выберите все интересные варианты – после окончания регистрации система распределит вас случайным образом на одно мероприятие из каждой волны, на которое вы подали заявку. Обратите внимание, что количество мест ограничено, при большом количестве желающих есть вероятность никуда не попасть.
      </p>
      {accessibleWaves.map((wave) => {
        const waveEvents = getEventsForWave(wave);
        const registeredCount = getRegisteredEventsCountForWave(wave);
        const isExpanded = expandedWaves.has(wave.id);
        
        return (
          <div key={wave.id} className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleWave(wave.id)}
              className="w-full px-4 py-3 text-left flex items-center justify-between transition-colors hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    {wave.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Мероприятий: {waveEvents.length}, заявлены на: {registeredCount}
                  </p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>
            
            {isExpanded && (
              <div className="border-t border-gray-200 bg-gray-50">
                <div className="p-2 sm:p-4 space-y-3">
                  {waveEvents.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      В этой волне пока нет мероприятий
                    </p>
                  ) : (
                    waveEvents.map((event) => (
                      <EventCard key={event.id} event={event} eventumSlug={eventumSlug} onEventUpdate={(updatedEvent) => {
                        // Обновляем событие в локальном состоянии
                        setLocalEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
                      }} />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Компонент карточки мероприятия
const EventCard: React.FC<{ event: Event; eventumSlug: string; onEventUpdate?: (event: Event) => void }> = ({ event, eventumSlug, onEventUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    setIsLoading(true);
    try {
      await registerForEvent(eventumSlug, event.id);
      // Обновляем состояние события
      const updatedEvent = { 
        ...event, 
        is_registered: true,
        registrations_count: event.registrations_count + 1
      };
      onEventUpdate?.(updatedEvent);
      // Принудительно обновляем компонент
      window.dispatchEvent(new CustomEvent('eventRegistrationChanged'));
    } catch (error) {
      console.error('Ошибка подачи заявки на мероприятие:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnregister = async () => {
    setIsLoading(true);
    try {
      await unregisterFromEvent(eventumSlug, event.id);
      // Обновляем состояние события
      const updatedEvent = { 
        ...event, 
        is_registered: false,
        registrations_count: Math.max(0, event.registrations_count - 1)
      };
      onEventUpdate?.(updatedEvent);
      // Принудительно обновляем компонент
      window.dispatchEvent(new CustomEvent('eventRegistrationChanged'));
    } catch (error) {
      console.error('Ошибка отмены заявки на мероприятие:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getLocationText = () => {
    if (!event.locations || event.locations.length === 0) {
      return 'Локация не указана';
    }
    
    // Функция для получения уникальных частей пути локаций
    const getUniqueLocationParts = (locations: any[]) => {
      const allParts = new Set<string>();
      
      locations.forEach(loc => {
        const parts = loc.full_path.split(', ');
        parts.forEach((part: string) => allParts.add(part.trim()));
      });
      
      return Array.from(allParts);
    };
    
    const uniqueParts = getUniqueLocationParts(event.locations);
    return uniqueParts.join(', ');
  };

  const getParticipantsInfo = () => {
    if (event.participant_type === 'all') {
      return 'Для всех участников';
    } else if (event.participant_type === 'registration' && event.max_participants) {
      return `Заявок/мест: ${event.registrations_count}/${event.max_participants}`;
    } else if (event.participant_type === 'manual') {
      return 'По приглашению';
    }
    return 'Участники определяются отдельно';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-4 hover:shadow-md transition-shadow">
      {/* Мобильная версия - вертикальная компоновка */}
      <div className="block sm:hidden space-y-3">
        <h4 className="text-lg font-semibold text-gray-900">{event.name}</h4>
        
        {event.image_url && (
          <div>
            <img
              src={event.image_url}
              alt={event.name}
              className="w-full max-w-xs h-56 object-cover rounded-lg shadow-lg"
            />
          </div>
        )}
        
        {event.description && (
          <p className="text-gray-600 text-sm">{event.description}</p>
        )}
        
        <div className="space-y-2 text-sm text-gray-500">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span>{getLocationText()}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <span>{getParticipantsInfo()}</span>
          </div>
        </div>
      </div>

      {/* Десктопная версия - горизонтальная компоновка */}
      <div className="hidden sm:flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">{event.name}</h4>
          
          {event.description && (
            <p className="text-gray-600 text-sm mb-3">{event.description}</p>
          )}
          
          <div className="space-y-2 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span>{getLocationText()}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <span>{getParticipantsInfo()}</span>
            </div>
          </div>
        </div>
        
        {event.image_url && (
          <div className="ml-4 flex-shrink-0">
            <img
              src={event.image_url}
              alt={event.name}
              className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg shadow-lg"
            />
          </div>
        )}
      </div>
      
      {/* Кнопка подачи заявки для мероприятий с типом "По записи" */}
      {event.participant_type === 'registration' && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {event.is_registered ? (
            <div className="flex items-center gap-4">
              <button
                onClick={handleUnregister}
                disabled={isLoading}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-md transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Отмена...' : 'Отменить заявку'}
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <button
                onClick={handleRegister}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Подача заявки...' : 'Подать заявку'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventumPage;
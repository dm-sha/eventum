import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import { getEventumBySlug } from "../api/eventum";
import { listEventWaves } from "../api/eventWave";
import { getEventsForEventum, registerForEvent, unregisterFromEvent } from "../api/event";
import { getCurrentParticipant, getMyRegistrations, getParticipantById, getParticipantRegistrations } from "../api/participant";
import { authApi } from "../api/eventumApi";
import type { Eventum, Event, Participant, UserRole, EventRegistration } from "../types";
import type { EventWave } from "../api/eventWave";
import LoadingSpinner from "../components/LoadingSpinner";
import EventCalendar from "../components/EventCalendar";
import { useEventumSlug } from "../hooks/useEventumSlug";
import { getEventumScopedPath } from "../utils/eventumSlug";

// Компонент для раскрывающегося текста
const ExpandableText: React.FC<{ text: string; maxLength?: number; className?: string }> = ({ 
  text, 
  maxLength = 150, 
  className = "" 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!text) return null;
  
  const shouldTruncate = text.length > maxLength;
  const displayText = shouldTruncate && !isExpanded 
    ? text.substring(0, maxLength) + "..." 
    : text;
  
  return (
    <div className={className}>
      <p className="whitespace-pre-wrap">{displayText}</p>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-400 hover:text-blue-600 text-sm font-medium mt-1"
        >
          {isExpanded ? "Свернуть" : "Показать полностью"}
        </button>
      )}
    </div>
  );
};

const EventumPage = () => {
  const eventumSlug = useEventumSlug();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [eventum, setEventum] = useState<Eventum | null>(null);
  const [eventWaves, setEventWaves] = useState<EventWave[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Получаем ID участника из URL параметров (для просмотра от лица другого участника)
  const participantId = searchParams.get('participant');

  // Определяем текущую вкладку из URL
  const currentTab = location.pathname.split('/').pop() || 'general';

  // Функция для проверки, является ли пользователь организатором данного eventum
  const isUserOrganizer = (eventumId: number): boolean => {
    return userRoles.some(role => {
      // API может возвращать eventum как число или как объект с id
      const roleEventumId = typeof role.eventum === 'object' && role.eventum !== null 
        ? (role.eventum as { id: number }).id 
        : role.eventum;
      return roleEventumId === eventumId && role.role === 'organizer';
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!eventumSlug) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Сначала загружаем роли, чтобы знать, является ли пользователь организатором
        const rolesData = await authApi.getRoles();
        setUserRoles(rolesData.data);
        
        // Загружаем eventum
        let eventumData: Eventum;
        try {
          eventumData = await getEventumBySlug(eventumSlug);
        } catch (err) {
          const error = err as { response?: { status?: number } };
          if (error?.response?.status === 403) {
            // Если 403, проверяем, является ли пользователь организатором любого eventum
            // Если да, то продолжаем (возможно, это ошибка API при просмотре от лица другого участника)
            const hasAnyOrganizerRole = rolesData.data.some(role => role.role === 'organizer');
            if (!hasAnyOrganizerRole) {
              setError('У вас нет доступа к этому событию. Вы должны быть участником или организатором, чтобы просматривать информацию о событии.');
              return;
            }
            // Если пользователь организатор, но получили 403, пробуем продолжить
            // Возможно, нужно загрузить eventum по-другому или просто показать ошибку
            setError('У вас нет доступа к этому событию. Вы должны быть участником или организатором, чтобы просматривать информацию о событии.');
            return;
          } else {
            throw err;
          }
        }
        
        setEventum(eventumData);
        
        // Проверяем, является ли пользователь организатором этого eventum
        const isOrganizer = rolesData.data.some(role => {
          const roleEventumId = typeof role.eventum === 'object' && role.eventum !== null 
            ? (role.eventum as { id: number }).id 
            : role.eventum;
          return roleEventumId === eventumData.id && role.role === 'organizer';
        });
        
        // Загружаем остальные данные параллельно, обрабатывая ошибки 403 для организаторов
        let wavesData: EventWave[] = [];
        let eventsData: Event[] = [];
        
        // Выполняем оба запроса параллельно
        const [wavesResult, eventsResult] = await Promise.allSettled([
          listEventWaves(eventumSlug, participantId ? { participant: parseInt(participantId) } : undefined),
          getEventsForEventum(eventumSlug)
        ]);
        
        // Обрабатываем результат загрузки волн
        if (wavesResult.status === 'fulfilled') {
          wavesData = wavesResult.value;
        } else {
          const error = wavesResult.reason as { response?: { status?: number } };
          if (error?.response?.status === 403 && !isOrganizer) {
            setError('У вас нет доступа к этому событию. Вы должны быть участником или организатором, чтобы просматривать информацию о событии.');
            return;
          }
          // Для организаторов игнорируем ошибки 403 при просмотре от лица другого участника
          console.error('Ошибка загрузки волн мероприятий:', wavesResult.reason);
        }
        
        // Обрабатываем результат загрузки мероприятий
        if (eventsResult.status === 'fulfilled') {
          eventsData = eventsResult.value;
        } else {
          const error = eventsResult.reason as { response?: { status?: number } };
          if (error?.response?.status === 403 && !isOrganizer) {
            setError('У вас нет доступа к этому событию. Вы должны быть участником или организатором, чтобы просматривать информацию о событии.');
            return;
          }
          // Для организаторов игнорируем ошибки 403 при просмотре от лица другого участника
          console.error('Ошибка загрузки мероприятий:', eventsResult.reason);
        }
        
        setEventWaves(wavesData);
        
        // Загружаем данные участника отдельно, чтобы 404 не ломал всю страницу
        let participantData = null;
        let registrationsData: EventRegistration[] = [];
        try {
          if (participantId) {
            // Если указан ID участника, загружаем данные конкретного участника (для организаторов)
            participantData = await getParticipantById(eventumSlug, parseInt(participantId));
            if (participantData) {
              try {
                registrationsData = await getParticipantRegistrations(eventumSlug, parseInt(participantId));
              } catch (registrationsErr: unknown) {
                console.error('Ошибка загрузки заявок участника:', registrationsErr);
              }
            }
          } else {
            // Обычная логика для текущего пользователя
            participantData = await getCurrentParticipant(eventumSlug);
            // Если участник найден, загружаем его заявки
            if (participantData) {
              try {
                registrationsData = await getMyRegistrations(eventumSlug);
              } catch (registrationsErr: unknown) {
                console.error('Ошибка загрузки заявок участника:', registrationsErr);
              }
            }
          }
        } catch (participantErr: unknown) {
          // Если пользователь не является участником (404), это нормально
          const error = participantErr as { response?: { status?: number } };
          if (error?.response?.status !== 404) {
            console.error('Ошибка загрузки данных участника:', participantErr);
          }
        }
        
        // Если просматриваем от лица другого участника, обновляем is_registered в events на основе myRegistrations
        if (participantId) {
          // Создаём Map для быстрого поиска регистраций по ID события
          const registrationsMap = new Map<number, any>();
          registrationsData.forEach((reg: any) => {
            const eventId = reg.event?.id ?? reg.id;
            if (eventId && typeof eventId === 'number') {
              registrationsMap.set(eventId, reg);
            }
          });
          eventsData.forEach(event => {
            const reg = registrationsMap.get(event.id);
            if (reg) {
              // Используем is_registered из регистрации, если есть, иначе считаем что зарегистрирован
              event.is_registered = reg.is_registered !== undefined ? reg.is_registered : true;
            } else {
              // Если регистрации нет, значит не зарегистрирован
              event.is_registered = false;
            }
          });
        }
        setEvents(eventsData);
        setCurrentParticipant(participantData);
        setMyRegistrations(registrationsData);
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        const error = err as { response?: { status?: number } };
        // Проверяем, является ли ошибка 403 (доступ запрещен)
        if (error?.response?.status === 403) {
          setError('У вас нет доступа к этому событию. Вы должны быть участником или организатором, чтобы просматривать информацию о событии.');
        } else {
          setError('Не удалось загрузить информацию о событии');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventumSlug, participantId]);

  const handleTabChange = (tab: string) => {
    if (!eventumSlug) return;
    
    // Сохраняем существующие параметры URL
    const currentParams = new URLSearchParams(searchParams);
    const queryString = currentParams.toString();
    const pathWithParams = queryString ? `/${tab}?${queryString}` : `/${tab}`;
    
    navigate(getEventumScopedPath(eventumSlug, pathWithParams));
  };

  // Глобально обновляем список событий при изменении регистрации,
  // чтобы состояние сохранялось при переключении вкладок
  const handleEventRegistrationChangeGlobal = useCallback((eventId: number, isRegistered: boolean) => {
    setEvents(prev => prev.map(ev => {
      if (ev.id !== eventId) return ev;
      const delta = isRegistered ? 1 : -1;
      return {
        ...ev,
        is_registered: isRegistered,
        registrations_count: Math.max(0, (ev.registrations_count ?? 0) + delta),
      };
    }));
  }, []);

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
    <main className="min-h-screen bg-gray-50 px-1 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {/* Заголовок */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              {eventum.name}
            </h1>
            {participantId && currentParticipant && (
              <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Просмотр от лица участника: <strong>{currentParticipant.name}</strong></span>
              </div>
            )}
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
            {currentParticipant && (
              <button
                onClick={() => handleTabChange('distribution')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  currentTab === 'distribution'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Распределение на мероприятия
              </button>
            )}
            {eventum && (eventum.schedule_visible || (isUserOrganizer(eventum.id) && participantId)) && (
              <button
                onClick={() => handleTabChange('schedule')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  currentTab === 'schedule'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Расписание
              </button>
            )}
          </nav>
        </div>

        {/* Контент вкладок */}
        <div>
          {currentTab === 'general' && (
            <GeneralTab eventum={eventum} />
          )}
          {currentTab === 'registration' && eventumSlug && (
            <RegistrationTab 
              eventWaves={eventWaves} 
              events={events} 
              currentParticipant={currentParticipant} 
              eventumSlug={eventumSlug} 
              eventum={eventum} 
              myRegistrations={myRegistrations} 
              participantId={participantId}
              onEventRegistrationChange={handleEventRegistrationChangeGlobal}
            />
          )}
          {currentTab === 'distribution' && eventumSlug && (
            <DistributionTab 
              myRegistrations={myRegistrations}
              currentParticipant={currentParticipant}
            />
          )}
          {currentTab === 'schedule' && eventumSlug && eventum && (eventum.schedule_visible || (isUserOrganizer(eventum.id) && participantId)) && (
            <ScheduleTab events={events} currentParticipant={currentParticipant} participantId={participantId} />
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

// Компонент для вкладки "Распределение на мероприятия"
const DistributionTab: React.FC<{ myRegistrations: EventRegistration[]; currentParticipant: Participant | null }> = ({ myRegistrations, currentParticipant }) => {
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
          Чтобы просматривать распределение на мероприятия, вам нужно стать участником этого события. 
          Обратитесь к организаторам для получения доступа.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {myRegistrations.length > 0 ? (
        <div className="space-y-6">
          {/* Мероприятия, в которых участник участвует */}
          {(() => {
            // myRegistrations - это массив Event объектов (не EventRegistration), у которых есть поле is_registered
            // которое правильно вычисляется на бэкенде с учетом v2 групп
            // Участвует только если is_registered строго равно true (участник в event_group_v2)
            const participatingEvents = myRegistrations
              .filter((event: any) => 
                event && 
                event.is_registered === true
              )
              .sort((a: any, b: any) => {
                if (!a?.start_time || !b?.start_time) return 0;
                return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
              });
            
            return participatingEvents.length > 0 ? (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Мероприятия, в которых вы участвуете</h4>
                <div className="space-y-3">
                  {participatingEvents.map((event: any) => (
                    <div key={event.id} className="bg-green-50 rounded-lg border border-green-200 p-4 overflow-hidden">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 mb-2">
                            <h5 className="text-lg font-medium text-gray-900">{event.name}</h5>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Участвуете
                            </span>
                          </div>
                          {event.description && (
                            <ExpandableText 
                              text={event.description} 
                              maxLength={120}
                              className="mt-1 text-gray-600 text-sm"
                            />
                          )}
                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            <span>
                              {new Date(event.start_time).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {event.locations && event.locations.length > 0 && (
                            <div className="mt-1 flex items-center text-sm text-gray-500">
                              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" />
                              </svg>
                              <span>
                                {(() => {
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
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                        {event.image_url && (
                          <div className="flex-shrink-0 max-w-[min(48px,20%)] sm:max-w-none">
                            <img
                              src={event.image_url}
                              alt={event.name}
                              className="w-12 h-auto sm:w-16 max-w-full object-contain rounded-lg shadow"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* Мероприятия, на которые подавал заявку, но не участвует */}
          {(() => {
            // Мероприятия, на которые подали заявку (есть в myRegistrations), но не участвуете
            // (is_registered !== true, т.е. заявка есть, но участник не в event_group_v2)
            const appliedEvents = myRegistrations
              .filter((event: any) => 
                event && 
                event.is_registered !== true
              )
              .sort((a: any, b: any) => {
                if (!a?.start_time || !b?.start_time) return 0;
                return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
              });
            
            return appliedEvents.length > 0 ? (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Мероприятия, на которые была подана заявка</h4>
                <div className="space-y-3">
                  {appliedEvents.map((event: any) => (
                    <div key={event.id} className="bg-white rounded-lg border border-gray-200 p-4 overflow-hidden">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 mb-2">
                            <h5 className="text-lg font-medium text-gray-900">{event.name}</h5>
                          </div>
                          {event.description && (
                            <ExpandableText 
                              text={event.description} 
                              maxLength={120}
                              className="mt-1 text-gray-600 text-sm"
                            />
                          )}
                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            <span>
                              {new Date(event.start_time).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {event.locations && event.locations.length > 0 && (
                            <div className="mt-1 flex items-center text-sm text-gray-500">
                              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" />
                              </svg>
                              <span>
                                {(() => {
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
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                        {event.image_url && (
                          <div className="flex-shrink-0 max-w-[min(48px,20%)] sm:max-w-none">
                            <img
                              src={event.image_url}
                              alt={event.name}
                              className="w-12 h-auto sm:w-16 max-w-full object-contain rounded-lg shadow"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="h-6 w-6 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2 2 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
              />
            </svg>
          </div>
          <h4 className="mt-3 text-lg font-semibold text-gray-900">Заявок не подано</h4>
          <p className="mt-1 text-gray-600">
            Вы не подавали заявки на мероприятия в этом событии.
          </p>
        </div>
      )}
    </div>
  );
};

// Компонент для вкладки "Подача заявок на мероприятия"
const RegistrationTab: React.FC<{ eventWaves: EventWave[]; events: Event[]; currentParticipant: Participant | null; eventumSlug: string; eventum: Eventum; myRegistrations: EventRegistration[]; participantId: string | null; onEventRegistrationChange?: (eventId: number, isRegistered: boolean) => void }> = ({ eventWaves, events, currentParticipant, eventumSlug, eventum, myRegistrations, participantId, onEventRegistrationChange }) => {
  const [expandedWaves, setExpandedWaves] = useState<Set<number>>(new Set());
  // Локальное отслеживание регистраций для быстрого обновления UI
  const [eventRegistrations, setEventRegistrations] = useState<Map<number, boolean>>(() => {
    const map = new Map<number, boolean>();
    // events уже содержат правильные значения is_registered (обновлены в родительском компоненте)
    events.forEach(event => {
      map.set(event.id, event.is_registered);
    });
    return map;
  });

  const toggleWave = (waveId: number) => {
    const newExpanded = new Set(expandedWaves);
    if (newExpanded.has(waveId)) {
      newExpanded.delete(waveId);
    } else {
      newExpanded.add(waveId);
    }
    setExpandedWaves(newExpanded);
  };

  // Синхронизируем локальное состояние регистраций с пропсами
  useEffect(() => {
    const newMap = new Map<number, boolean>();
    // Если просматриваем от лица другого участника, events уже обновлены с правильными is_registered
    // Используем events напрямую, так как они уже содержат правильные значения is_registered
    events.forEach(event => {
      newMap.set(event.id, event.is_registered);
    });
    setEventRegistrations(newMap);
  }, [events, myRegistrations, participantId]);

  const getEventsForWave = useCallback((wave: EventWave) => {
    // Получаем актуальные события из массива events по ID из волны
    const waveEventIds = new Set(wave.events.map(e => e.id));
    // Разрешенные к показу события определяем по доступности соответствующих регистраций
    const allowedEventIds = new Set(
      (wave.registrations || [])
        .filter((reg: any) => reg && (reg.is_accessible ?? true) && reg.event && typeof reg.event.id === 'number')
        .map((reg: any) => reg.event.id)
    );
    return events
      .filter(event => waveEventIds.has(event.id))
      .filter(event => allowedEventIds.has(event.id));
  }, [events]);

  const getRegisteredEventsCountForWave = (wave: EventWave) => {
    if (!currentParticipant) return 0;
    // Получаем все события волны (не фильтруем по доступности для подсчёта)
    const waveEventIds = new Set(wave.events.map(e => e.id));
    // Считаем все зарегистрированные события из волны, независимо от доступности
    return events
      .filter(event => waveEventIds.has(event.id))
      .filter(event => eventRegistrations.get(event.id) === true).length;
  };

  // Callback для обновления регистрации события
  const handleEventRegistrationChange = useCallback((eventId: number, isRegistered: boolean) => {
    setEventRegistrations(prev => {
      const newMap = new Map(prev);
      newMap.set(eventId, isRegistered);
      return newMap;
    });
  }, []);

  // Обновляем локально и пробрасываем изменение наверх
  const handleLocalAndGlobalChange = useCallback((eventId: number, isRegistered: boolean) => {
    handleEventRegistrationChange(eventId, isRegistered);
    onEventRegistrationChange?.(eventId, isRegistered);
  }, [handleEventRegistrationChange, onEventRegistrationChange]);

  // Проверяем доступность волны для текущего участника
  // Note: Access control is now handled at the event level (via EventRegistration.allowed_group),
  // so waves themselves are accessible if the user is a participant
  const isWaveAccessible = (_wave: EventWave) => {
    if (!currentParticipant) {
      return { accessible: false, reason: 'Вы не являетесь участником этого события' };
    }

    // Wave is accessible if user is a participant
    // Individual events may have their own access restrictions via allowed_group
    return { accessible: true, reason: '' };
  };

  // Если регистрация закрыта
  if (!eventum.registration_open) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-8 w-8 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Регистрация завершена</h3>
      </div>
    );
  }

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

  // Фильтруем только доступные волны, в которых есть хотя бы одно доступное мероприятие, и сортируем по названию
  const accessibleWaves = eventWaves
    .filter(wave => isWaveAccessible(wave).accessible)
    .filter(wave => getEventsForWave(wave).length > 0)
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
    <div className="space-y-2 sm:space-y-4">
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
                    waveEvents.map((event) => {
                      const reg = (wave.registrations || []).find((r: any) => r && r.event && typeof r.event.id === 'number' && r.event.id === event.id);
                      // Для просмотра от лица другого участника: myRegistrations содержит Event[], поэтому проверяем по event.id напрямую
                      const initialIsRegistered = participantId 
                        ? myRegistrations.some((r: any) => {
                            const eventId = r.event?.id ?? r.id;
                            return eventId && typeof eventId === 'number' && eventId === event.id && (r.is_registered !== undefined ? r.is_registered : true);
                          })
                        : undefined;
                      return (
                        <EventCard 
                          key={`${event.id}-${event.is_registered}-${event.registrations_count}`} 
                          event={event} 
                          eventumSlug={eventumSlug} 
                          isViewingAsOtherParticipant={!!participantId}
                          initialIsRegistered={initialIsRegistered}
                          onLocalRegistrationChange={handleLocalAndGlobalChange}
                          registrationMaxParticipants={reg?.max_participants ?? null}
                        />
                      );
                    })
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
const EventCard: React.FC<{ event: Event; eventumSlug: string; isViewingAsOtherParticipant?: boolean; initialIsRegistered?: boolean; onLocalRegistrationChange?: (eventId: number, isRegistered: boolean) => void; registrationMaxParticipants?: number | null }> = ({ event, eventumSlug, isViewingAsOtherParticipant = false, initialIsRegistered, onLocalRegistrationChange, registrationMaxParticipants = null }) => {
  // Отдельные состояния для отслеживания загрузки каждой операции
  const [isRegistering, setIsRegistering] = useState(false);
  const [isUnregistering, setIsUnregistering] = useState(false);
  // Локальное состояние для оптимистичного обновления UI
  const [localIsRegistered, setLocalIsRegistered] = useState(
    typeof initialIsRegistered === 'boolean' ? initialIsRegistered : event.is_registered
  );
  const [localRegistrationsCount, setLocalRegistrationsCount] = useState(event.registrations_count);
  // Флаг для отслеживания, что мы сами обновили состояние (чтобы не перезаписывать из пропсов)
  const hasLocalUpdate = useRef(false);

  // Синхронизируем локальное состояние с пропсом при его изменении
  // Но только если нет активной операции и мы не делали локальных обновлений
  useEffect(() => {
    if (!isRegistering && !isUnregistering && !hasLocalUpdate.current) {
      const nextIsRegistered = typeof initialIsRegistered === 'boolean' ? initialIsRegistered : event.is_registered;
      setLocalIsRegistered(nextIsRegistered);
      setLocalRegistrationsCount(event.registrations_count);
    }
    if (!isRegistering && !isUnregistering) {
      hasLocalUpdate.current = false;
    }
  }, [initialIsRegistered, event.is_registered, event.registrations_count, isRegistering, isUnregistering]);

  const handleRegister = async () => {
    if (isRegistering || isUnregistering || localIsRegistered) return;
    
    // Для типа application заявок может быть больше чем max_participants,
    // администратор потом выберет, кого одобрить, поэтому проверка не нужна
    
    setIsRegistering(true);
    // Оптимистично обновляем только счётчик, статус регистрации обновим после успеха
    setLocalRegistrationsCount(prev => prev + 1);
    
    try {
      await registerForEvent(eventumSlug, event.id);
      // После успеха обновляем статус регистрации
      // Не делаем запрос к серверу - локальное состояние достаточно,
      // кеш на бэкенде уже инвалидирован, при следующем естественном обновлении данные синхронизируются
      hasLocalUpdate.current = true;
      setLocalIsRegistered(true);
      // Уведомляем родительский компонент об изменении для обновления счётчика в волне
      onLocalRegistrationChange?.(event.id, true);
    } catch (error: any) {
      console.error('Ошибка подачи заявки на мероприятие:', error);
      // Откатываем оптимистичное обновление счётчика при ошибке
      setLocalRegistrationsCount(prev => prev - 1);
      // Обрабатываем различные ошибки
      if (error?.response?.data?.error === 'Application already submitted' || 
          error?.response?.data?.error === 'Already registered for this event') {
        hasLocalUpdate.current = true;
        setLocalIsRegistered(true);
        onLocalRegistrationChange?.(event.id, true);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleUnregister = async () => {
    if (isRegistering || isUnregistering || !localIsRegistered) return;
    
    setIsUnregistering(true);
    // Оптимистично обновляем только счётчик, статус регистрации обновим после успеха
    setLocalRegistrationsCount(prev => Math.max(0, prev - 1));
    
    try {
      await unregisterFromEvent(eventumSlug, event.id);
      // После успеха обновляем статус регистрации
      // Не делаем запрос к серверу - локальное состояние достаточно,
      // кеш на бэкенде уже инвалидирован, при следующем естественном обновлении данные синхронизируются
      hasLocalUpdate.current = true;
      setLocalIsRegistered(false);
      // Уведомляем родительский компонент об изменении для обновления счётчика в волне
      onLocalRegistrationChange?.(event.id, false);
    } catch (error: any) {
      console.error('Ошибка отмены заявки на мероприятие:', error);
      // Откатываем оптимистичное обновление счётчика при ошибке
      setLocalRegistrationsCount(prev => prev + 1);
      // Если заявка уже была отменена, обновляем локальное состояние
      if (error?.response?.data?.error === 'Application not found' || 
          error?.response?.data?.error === 'Not registered for this event') {
        hasLocalUpdate.current = true;
        setLocalIsRegistered(false);
        onLocalRegistrationChange?.(event.id, false);
      }
    } finally {
      setIsUnregistering(false);
    }
  };

  const getLocationText = () => {
    if (!event.locations || event.locations.length === 0) {
      return null;
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
    if (event.registration_type === 'button' || event.registration_type === 'application') {
      // Для мероприятий с регистрацией показываем количество заявок/мест (используем локальное состояние)
      const maxFromRegistration = registrationMaxParticipants ?? undefined;
      const max = typeof maxFromRegistration === 'number' ? maxFromRegistration : event.max_participants;
      if (typeof max === 'number' && max > 0) {
        return `Заявок/мест: ${localRegistrationsCount}/${max}`;
      }
      return `Заявок: ${localRegistrationsCount}`;
    } else if (event.participant_type === 'all') {
      return 'Для всех участников';
    } else if (event.participant_type === 'manual') {
      return 'По приглашению';
    }
    return 'Участники определяются отдельно';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-4 hover:shadow-md transition-shadow overflow-hidden">
      {/* Мобильная версия - вертикальная компоновка */}
      <div className="block sm:hidden space-y-3">
        <h4 className="text-lg font-semibold text-gray-900">{event.name}</h4>
        
        {event.image_url && (
          <div>
            <img
              src={event.image_url}
              alt={event.name}
              className="max-w-xs w-auto h-auto object-contain rounded-lg shadow-lg mx-auto"
            />
          </div>
        )}
        
        {event.description && (
          <ExpandableText 
            text={event.description} 
            maxLength={150}
            className="text-gray-600 text-sm"
          />
        )}
      </div>

      {/* Десктопная версия - горизонтальная компоновка */}
      <div className="hidden sm:flex items-stretch gap-4">
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">{event.name}</h4>
            
            {event.description && (
              <ExpandableText 
                text={event.description} 
                maxLength={200}
                className="text-gray-600 text-sm"
              />
            )}
          </div>
          
          {/* Информация о локации и участниках - выровнена по нижнему краю */}
          <div className="space-y-2 text-sm text-gray-500">
            {getLocationText() && (
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span>{getLocationText()}</span>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <span>{getParticipantsInfo()}</span>
            </div>
          </div>
        </div>
        
        {event.image_url && (
          <div className="flex-shrink-0 max-w-[min(64px,25%)] sm:max-w-none">
            <img
              src={event.image_url}
              alt={event.name}
              className="w-16 h-auto sm:w-36 sm:h-auto md:w-48 md:h-auto lg:w-56 lg:h-auto xl:w-64 xl:h-auto max-w-full object-contain rounded-lg shadow-lg"
            />
          </div>
        )}
      </div>
      
      {/* Информация о локации и участниках для мобильной версии */}
      <div className="block sm:hidden mt-2 space-y-2 text-sm text-gray-500">
        {getLocationText() && (
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span>{getLocationText()}</span>
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <span>{getParticipantsInfo()}</span>
        </div>
      </div>

      {/* Кнопка подачи заявки для мероприятий с регистрацией (button или application) */}
      {(event.registration_type === 'button' || event.registration_type === 'application') && !isViewingAsOtherParticipant && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {localIsRegistered ? (
            <div className="flex items-center gap-4">
              <button
                onClick={handleUnregister}
                disabled={isRegistering || isUnregistering}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-md transition-colors disabled:opacity-50"
              >
                {isUnregistering ? 'Отмена...' : event.registration_type === 'button' ? 'Отписаться' : 'Отменить заявку'}
              </button>
            </div>
          ) : (
            <div className="flex items-center">
              <button
                onClick={handleRegister}
                disabled={isRegistering || isUnregistering}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRegistering ? (event.registration_type === 'button' ? 'Запись...' : 'Подача заявки...') : (event.registration_type === 'button' ? 'Записаться' : 'Подать заявку')}
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Информация о статусе заявки при просмотре от лица другого участника */}
      {(event.registration_type === 'button' || event.registration_type === 'application') && isViewingAsOtherParticipant && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm">
            {localIsRegistered ? (
              <>
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-600">
                  {event.registration_type === 'button' ? 'Записан' : 'Заявка подана'}
                </span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-gray-500">
                  {event.registration_type === 'button' ? 'Не записан' : 'Заявка не подана'}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Компонент для вкладки "Расписание"
const ScheduleTab: React.FC<{ events: Event[]; currentParticipant: Participant | null; participantId: string | null }> = ({ events, currentParticipant, participantId }) => {
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
          Чтобы просматривать расписание мероприятий, вам нужно стать участником этого события. 
          Обратитесь к организаторам для получения доступа.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EventCalendar 
        events={events} 
        participantId={participantId ? parseInt(participantId) : currentParticipant.id} 
        currentParticipant={currentParticipant}
      />
    </div>
  );
};

export default EventumPage;
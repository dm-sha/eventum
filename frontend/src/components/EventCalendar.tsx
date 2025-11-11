import React, { useState, useMemo, useEffect } from 'react';
import type { Event, Participant } from '../types';
import EventModal from './EventModal';
import { downloadParticipantCalendar, getParticipantCalendarWebcalUrl } from '../api/event';
import { IconCalendarDownload, IconCalendarSubscribe } from './icons';
import { useEventumSlug } from '../hooks/useEventumSlug';
import { resolveApiBaseUrl } from '../api/baseUrl';
import './EventCalendar.css';

interface EventCalendarProps {
  events: Event[];
  participantId?: number | null;
  currentParticipant?: Participant | null;
}

const EventCalendar: React.FC<EventCalendarProps> = ({ events, participantId, currentParticipant }) => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoadingWebcal, setIsLoadingWebcal] = useState(false);
  
  const eventumSlug = useEventumSlug();

  // Фильтруем мероприятия для участника
  const participantEvents = useMemo(() => {
    if (!participantId || !currentParticipant) return events;

    return events.filter(event => {
      // Используем is_participant, которое правильно вычисляется на бэкенде
      // с учетом вложенных групп для всех типов мероприятий
      // (работает и для мероприятий с регистрацией, и без)
      // Для мероприятий без регистрации (без event_group) все участники eventum видят их
      return event.is_participant === true;
    });
  }, [events, participantId, currentParticipant]);

  // Находим первый день с мероприятием
  const firstEventDate = useMemo(() => {
    if (participantEvents.length === 0) return null;
    
    const sortedEvents = [...participantEvents].sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    
    return new Date(sortedEvents[0].start_time);
  }, [participantEvents]);

  // Получаем уникальные дни с мероприятиями
  const eventDays = useMemo(() => {
    if (participantEvents.length === 0) return [];
    
    const daysSet = new Set<string>();
    participantEvents.forEach(event => {
      const eventDate = new Date(event.start_time);
      const dateKey = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD
      daysSet.add(dateKey);
    });
    
    return Array.from(daysSet)
      .map(dateKey => new Date(dateKey))
      .sort((a, b) => a.getTime() - b.getTime());
  }, [participantEvents]);

  // Автоматически переходим к первому дню с мероприятием
  useEffect(() => {
    if (firstEventDate) {
      setCurrentDate(firstEventDate);
    }
  }, [firstEventDate]);

  // Группируем события по дням и времени
  const eventsByDay = useMemo(() => {
    if (!currentDate) return {};
    
    const dayEvents = participantEvents.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate.toDateString() === currentDate.toDateString();
    });

    // Сортируем события по времени начала
    dayEvents.sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    return {
      [currentDate.toDateString()]: dayEvents
    };
  }, [participantEvents, currentDate]);


  // Форматируем время
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleDayChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handleDownloadCalendar = async () => {
    if (!eventumSlug || !participantId) return;
    
    setIsDownloading(true);
    try {
      // Для iOS делаем переход синхронно, без await, чтобы сохранить контекст пользовательского действия
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        // Для iOS получаем URL синхронно и делаем переход сразу
        const baseURL = resolveApiBaseUrl();
        const cleanBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
        const url = `${cleanBaseURL}/eventums/${eventumSlug}/calendar/${participantId}.ics`;
        
        // Делаем переход синхронно, в контексте пользовательского клика
        // Это критично для Safari на iPhone - переход должен быть синхронным
        window.location.href = url;
        // Не сбрасываем состояние, так как происходит переход
        return;
      } else {
        // Для других платформ используем обычный подход
        await downloadParticipantCalendar(eventumSlug, participantId);
      }
    } catch (error) {
      console.error('Ошибка при скачивании календаря:', error);
      alert('Ошибка при скачивании календаря. Попробуйте еще раз.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubscribeToCalendar = async () => {
    if (!eventumSlug || !participantId) return;
    
    setIsLoadingWebcal(true);
    try {
      const response = await getParticipantCalendarWebcalUrl(eventumSlug, participantId);
      
      // Для календарных подписок используем webcal:// протокол
      const webcalUrl = response.webcal_url.replace('https://', 'webcal://');
      
      // Используем window.location.href для всех платформ
      // Браузер/ОС сам решит, как обработать webcal:// протокол
      window.location.href = webcalUrl;
      
    } catch (error) {
      console.error('Ошибка при подписке на календарь:', error);
      alert('Ошибка при подписке на календарь. Попробуйте еще раз.');
    } finally {
      // Сбрасываем состояние загрузки
      setTimeout(() => {
        setIsLoadingWebcal(false);
      }, 500);
    }
  };

  // Если нет мероприятий для участника
  if (participantEvents.length === 0) {
    return (
      <div className="w-full">
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
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
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Нет мероприятий в расписании</h3>
          <p className="mt-2 text-gray-600">
            У вас пока нет мероприятий в расписании. Возможно, вы не подали заявки на мероприятия или регистрация еще не завершена.
          </p>
        </div>
      </div>
    );
  }

  const currentDayEvents = currentDate ? eventsByDay[currentDate.toDateString()] || [] : [];

  return (
    <div className="w-full calendar-wrapper schedule-page">
      <div>
        {/* Заголовок с кнопками календаря */}
        <div className="p-4 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Расписание мероприятий</h2>
            <div className="flex flex-row items-center gap-2 calendar-header-buttons">
              <button
                onClick={handleDownloadCalendar}
                disabled={isDownloading || participantEvents.length === 0}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title="Скачать календарь в формате iCalendar (.ics)"
              >
                <IconCalendarDownload size={16} />
                <span className="hidden xs:inline">{isDownloading ? 'Скачивание...' : 'Скачать календарь'}</span>
                <span className="xs:hidden">{isDownloading ? 'Скачивание...' : 'Скачать'}</span>
              </button>
              
              <button
                onClick={handleSubscribeToCalendar}
                disabled={isLoadingWebcal || participantEvents.length === 0 || !participantId}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title="Подписаться на календарь в приложении календаря"
              >
                <IconCalendarSubscribe size={16} />
                <span className="hidden xs:inline">{isLoadingWebcal ? 'Открытие...' : 'Подписаться в календарь'}</span>
                <span className="xs:hidden">{isLoadingWebcal ? 'Открытие...' : 'Подписаться'}</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Переключатель дней */}
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {eventDays.map((day) => {
              const isActive = currentDate && 
                day.toDateString() === currentDate.toDateString();
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDayChange(day)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="text-center">
                    <div className="font-semibold">
                      {day.toLocaleDateString('ru-RU', { 
                        weekday: 'short',
                        day: 'numeric', 
                        month: 'short' 
                      })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Календарь с временной колонкой */}
        <div className="calendar-container">
          <div className="calendar-header">
            {currentDate && (
              <div className="day-info">
                <div className="day-name">
                  {currentDate.toLocaleDateString('ru-RU', { 
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="calendar-body">
            {currentDayEvents.length === 0 ? (
              <div className="no-events">
                <div className="no-events-icon">📅</div>
                <div className="no-events-text">Нет мероприятий на этот день</div>
              </div>
            ) : (
              <div className="events-list">
                {currentDayEvents.map((event) => {
                  return (
                    <div
                      key={event.id}
                      className="event-item"
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="event-time">
                        <div className="time-start">{formatTime(event.start_time)}</div>
                        <div className="time-end-group">
                          <div className="time-separator">-</div>
                          <div className="time-end">{formatTime(event.end_time)}</div>
                        </div>
                      </div>
                      <div className="event-content">
                        <div 
                          className="event-title-container"
                          style={{
                            backgroundColor: '#3b82f6',
                            borderColor: '#2563eb',
                            color: '#ffffff'
                          }}
                        >
                          <div className="event-title">
                            {event.name}
                          </div>
                          {event.locations && event.locations.length > 0 && (
                            <div className="event-location">
                              {event.locations.map(loc => loc.full_path).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default EventCalendar;

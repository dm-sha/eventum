import React, { useState, useMemo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { Event, Participant } from '../types';
import EventModal from './EventModal';
import './EventCalendar.css';

interface EventCalendarProps {
  events: Event[];
  participantId?: number | null;
  currentParticipant?: Participant | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps: {
    event: Event;
  };
}

const EventCalendar: React.FC<EventCalendarProps> = ({ events, participantId, currentParticipant }) => {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  // Фильтруем мероприятия для участника
  const participantEvents = useMemo(() => {
    if (!participantId || !currentParticipant) return events;

    return events.filter(event => {
      // Мероприятия для всех участников
      if (event.participant_type === 'all') {
        return true;
      }
      
      // Мероприятия по записи - показываем если участник подал заявку
      if (event.participant_type === 'registration') {
        return event.is_registered;
      }
      
      // Мероприятия вручную - проверяем различные способы назначения
      if (event.participant_type === 'manual') {
        // 1. Прямое назначение участника
        if (event.participants.includes(participantId)) {
          return true;
        }
        
        // 2. Назначение через группу участника
        const participantGroupIds = currentParticipant.groups?.map(g => g.id) || [];
        const hasGroupAssignment = event.groups.some(groupId => 
          participantGroupIds.includes(groupId)
        );
        if (hasGroupAssignment) {
          return true;
        }
        
        // 3. Назначение через теги групп участника
        const participantGroupTagIds = currentParticipant.groups?.flatMap(g => g.tags?.map(t => t.id) || []) || [];
        const hasGroupTagAssignment = event.group_tags.some(groupTag => 
          participantGroupTagIds.includes(groupTag.id)
        );
        if (hasGroupTagAssignment) {
          return true;
        }
      }
      
      return false;
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
    if (firstEventDate && calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(firstEventDate);
      setCurrentDate(firstEventDate);
    }
  }, [firstEventDate]);

  // Преобразуем события в формат FullCalendar
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return participantEvents.map(event => {
      let backgroundColor = '#3b82f6'; // Синий по умолчанию
      let borderColor = '#2563eb';
      let textColor = '#ffffff';

      // Разные цвета в зависимости от типа участника
      if (event.participant_type === 'all') {
        backgroundColor = '#10b981'; // Зеленый
        borderColor = '#059669';
      } else if (event.participant_type === 'registration') {
        backgroundColor = '#3b82f6'; // Синий
        borderColor = '#2563eb';
      } else if (event.participant_type === 'manual') {
        backgroundColor = '#8b5cf6'; // Фиолетовый
        borderColor = '#7c3aed';
      }

      return {
        id: event.id.toString(),
        title: event.name,
        start: event.start_time,
        end: event.end_time,
        backgroundColor,
        borderColor,
        textColor,
        className: `fc-event-type-${event.participant_type}`,
        extendedProps: {
          event
        }
      };
    });
  }, [participantEvents]);

  const handleEventClick = (clickInfo: any) => {
    const event = clickInfo.event.extendedProps.event;
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleDayChange = (date: Date) => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(date);
      setCurrentDate(date);
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

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-sm border p-4">
        {/* Переключатель дней */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {eventDays.map((day) => {
              const isActive = currentDate && 
                day.toDateString() === currentDate.toDateString();
              const dayEvents = participantEvents.filter(event => {
                const eventDate = new Date(event.start_time);
                return eventDate.toDateString() === day.toDateString();
              });
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDayChange(day)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="text-center">
                    <div className="font-semibold">
                      {day.toLocaleDateString('ru-RU', { 
                        day: 'numeric', 
                        month: 'short' 
                      })}
                    </div>
                    <div className="text-xs opacity-75">
                      {dayEvents.length} мероприятий
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridDay"
          headerToolbar={false}
          events={calendarEvents}
          eventClick={handleEventClick}
          height="auto"
          locale="ru"
          dayHeaderFormat={{ weekday: 'long', day: 'numeric', month: 'long' }}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }}
          displayEventTime={true}
          displayEventEnd={true}
          eventDisplay="block"
          dayMaxEvents={10}
          moreLinkClick="popover"
          eventDidMount={(info) => {
            // Добавляем курсор pointer для кликабельных событий
            info.el.style.cursor = 'pointer';
          }}
        />
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

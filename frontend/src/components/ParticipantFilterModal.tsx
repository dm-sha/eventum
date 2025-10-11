import React, { useState, useEffect } from 'react';
import { IconX, IconCheck } from '../components/icons';
import { getEventsForEventum, getParticipantsByEventFilter } from '../api';
import type { Event, Participant } from '../types';

interface ParticipantFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddParticipants: (participants: Participant[]) => void;
  eventumSlug: string;
}

type FilterType = 'participating' | 'not_participating';

const ParticipantFilterModal: React.FC<ParticipantFilterModalProps> = ({
  isOpen,
  onClose,
  onAddParticipants,
  eventumSlug,
}) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<Event[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('participating');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventQuery, setEventQuery] = useState('');

  useEffect(() => {
    if (isOpen && eventumSlug) {
      loadEvents();
    } else if (!isOpen) {
      // Очищаем состояние при закрытии модального окна
      setSelectedEvents([]);
      setEventQuery('');
    }
  }, [isOpen, eventumSlug]);

  const loadEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const eventsData = await getEventsForEventum(eventumSlug);
      setEvents(eventsData);
    } catch (error) {
      console.error('Ошибка загрузки мероприятий:', error);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleEventSelect = (event: Event) => {
    setSelectedEvents(prev => {
      if (prev.some(e => e.id === event.id)) return prev;
      return [...prev, event];
    });
    setEventQuery('');
  };

  const handleEventRemove = (eventId: number) => {
    setSelectedEvents(prev => prev.filter(e => e.id !== eventId));
  };

  const handleAddParticipants = async () => {
    if (selectedEvents.length === 0) {
      alert('Выберите хотя бы одно мероприятие');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Отправляем запрос с параметрами:', {
        eventumSlug,
        filterType,
        eventIds: selectedEvents.map(e => e.id)
      });
      
      const participants = await getParticipantsByEventFilter(
        eventumSlug,
        filterType,
        selectedEvents.map(e => e.id)
      );
      
      console.log('Получены участники:', participants);
      
      onAddParticipants(participants);
      onClose();
    } catch (error) {
      console.error('Ошибка получения участников:', error);
      alert('Ошибка при получении участников');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLocationText = (event: Event) => {
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

  // Фильтруем события для саджестов
  const filteredEvents = eventQuery
    ? events
        .filter(event => 
          event.name.toLowerCase().includes(eventQuery.toLowerCase()) &&
          !selectedEvents.some(selected => selected.id === event.id)
        )
    : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Добавить участников по фильтру</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <IconX size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Выбор типа фильтра */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Тип фильтра
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="filterType"
                  value="participating"
                  checked={filterType === 'participating'}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                  className="mr-3"
                />
                <span className="text-sm text-gray-700">
                  Все, кто участвует в выбранных мероприятиях
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="filterType"
                  value="not_participating"
                  checked={filterType === 'not_participating'}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                  className="mr-3"
                />
                <span className="text-sm text-gray-700">
                  Все, кроме тех кто участвует в выбранных мероприятиях
                </span>
              </label>
            </div>
          </div>

          {/* Выбор мероприятий */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Выберите мероприятия
            </label>
            
            {/* Поле ввода с саджестами */}
            <div className="mb-3">
              <div className="relative">
                <input
                  type="text"
                  value={eventQuery}
                  onChange={(e) => setEventQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Начните вводить название мероприятия..."
                />
                {filteredEvents.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-80 overflow-y-auto">
                    {filteredEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => handleEventSelect(event)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{event.name}</div>
                        <div className="text-xs text-gray-500">
                          {formatDateTime(event.start_time)} • {getLocationText(event)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Список выбранных мероприятий */}
            {selectedEvents.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-gray-500">Выбранные мероприятия:</div>
                <div className="space-y-1">
                  {selectedEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-blue-900">{event.name}</div>
                        <div className="text-xs text-blue-700">
                          {formatDateTime(event.start_time)} • {getLocationText(event)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleEventRemove(event.id)}
                        className="rounded p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600"
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {isLoadingEvents && (
              <div className="text-center py-4">
                <div className="text-sm text-gray-500">Загрузка мероприятий...</div>
              </div>
            )}
            
            {!isLoadingEvents && events.length === 0 && (
              <div className="text-center py-4">
                <div className="text-sm text-gray-500">Мероприятия не найдены</div>
              </div>
            )}
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleAddParticipants}
              disabled={selectedEvents.length === 0 || isLoading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <IconCheck size={16} />
                  Добавить участников ({selectedEvents.length} мероприятий)
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantFilterModal;

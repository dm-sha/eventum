import { useEffect, useState } from "react";
import { getEventsForEventum, createEvent, updateEvent, deleteEvent } from "../../api/event";
import { eventTagApi } from "../../api/eventTag";
import { getLocationsForEventum } from "../../api/location";
import { getParticipantsForEventum } from "../../api/participant";
import type { Event, EventTag, Location, Participant, GroupTag } from "../../types";
import {
  IconPencil,
  IconTrash,
  IconPlus,
  IconEllipsisHorizontal,
  IconChevronDown,
  IconArrowDownTray
} from "../../components/icons";
import EventEditModal from "../../components/event/EventEditModal";
import { useEventumSlug } from "../../hooks/useEventumSlug";
import EventsLoadingSkeleton from "../../components/admin/skeletons/EventsLoadingSkeleton";

interface EventWithTags extends Event {
  tags_data: EventTag[];
  group_tags_data?: GroupTag[];
}

const AdminEventsPage = () => {
  const eventumSlug = useEventumSlug();
  const [events, setEvents] = useState<EventWithTags[]>([]);
  const [eventTags, setEventTags] = useState<EventTag[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  
  // Модальное окно редактирования
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  useEffect(() => {
    if (eventumSlug) {
      loadData();
    }
  }, [eventumSlug]);


  const loadData = async () => {
    if (!eventumSlug) return;
    
    setIsLoading(true);
    try {
      const eventsData = await getEventsForEventum(eventumSlug);
      
      let tagsData: EventTag[] = [];
      
      let locationsData: Location[] = [];
      let participantsData: Participant[] = [];
      
      try {
        tagsData = await eventTagApi.getEventTags(eventumSlug);
      } catch (tagError) {
        console.error('Ошибка загрузки тегов:', tagError);
        // Продолжаем работу без тегов
      }
      
      try {
        participantsData = await getParticipantsForEventum(eventumSlug);
      } catch (participantError) {
        console.error('Ошибка загрузки участников:', participantError);
        // Продолжаем работу без участников
      }
      
      
      try {
        locationsData = await getLocationsForEventum(eventumSlug);
      } catch (locationError) {
        console.error('Ошибка загрузки локаций:', locationError);
        // Продолжаем работу без локаций
      }
      
      // Добавляем данные тегов к мероприятиям
      const eventsWithTags = eventsData.map(event => {
        // Теги приходят как объекты EventTag и GroupTag
        return {
          ...event,
          tags_data: event.tags,
          group_tags_data: event.group_tags
        };
      });
      
      setEvents(eventsWithTags);
      setEventTags(tagsData);
      setLocations(locationsData);
      setParticipants(participantsData);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEvents = events
    .filter(event => {
      const matchesSearch = event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           event.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTags = selectedTags.length === 0 || 
                         selectedTags.some(tagId => event.tags.some(tag => tag.id === tagId));
      return matchesSearch && matchesTags;
    })
    .sort((a, b) => {
      // Сортируем по времени начала мероприятия
      const dateA = new Date(a.start_time);
      const dateB = new Date(b.start_time);
      return dateA.getTime() - dateB.getTime();
    });


  const formatEventTime = (startTime: string, endTime: string) => {
    if (!startTime) return "Не указано";
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    const weekDays = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const dayOfWeek = weekDays[start.getDay()];
    
    const startTimeStr = start.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const endTimeStr = end.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `${dayOfWeek}, ${startTimeStr}-${endTimeStr}`;
  };

  const toggleEventExpansion = (eventId: number) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const handleTagToggle = (tagId: number) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };


  const openEditModal = (event?: Event) => {
    setEditingEvent(event || null);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingEvent(null);
  };

  const handleSaveEvent = async (eventData: {
    name: string;
    description: string;
    start_time: string;
    end_time: string;
    participant_type: 'all' | 'registration' | 'manual';
    max_participants?: number;
    image_url?: string;
    participants?: number[];
    groups?: number[];
    tags?: number[];
    tag_ids?: number[];
    group_tags?: number[];
    group_tag_ids?: number[];
    location_ids?: number[];
    // Новое: опциональная привязка к группе V2 (если указано — создадим связь после сохранения события)
    event_group_v2_id?: number | null;
  }) => {
    if (!eventumSlug) return;
    
    try {
      if (editingEvent) {
        const updated = await updateEvent(eventumSlug, editingEvent.id, eventData);
        setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...updated, tags_data: updated.tags, group_tags_data: updated.group_tags } : e));
      } else {
        const created = await createEvent(eventumSlug, eventData);
        setEvents(prev => [...prev, { ...created, tags_data: created.tags, group_tags_data: created.group_tags }]);
      }
    } catch (error) {
      console.error('Ошибка сохранения мероприятия:', error);
      // Пробрасываем ошибку, чтобы EventEditModal мог её обработать
      throw error;
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!eventumSlug || !confirm('Вы уверены, что хотите удалить это мероприятие?')) return;
    
    try {
      await deleteEvent(eventumSlug, eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (error) {
      console.error('Ошибка удаления мероприятия:', error);
    }
  };

  const exportEventsToCSV = () => {
    const csvData = filteredEvents.map(event => {
      // Форматируем время начала и окончания
      const startTime = event.start_time ? new Date(event.start_time).toLocaleString('ru-RU') : 'Не указано';
      const endTime = event.end_time ? new Date(event.end_time).toLocaleString('ru-RU') : 'Не указано';
      
      // Получаем названия локаций
      const locationNames = event.locations && event.locations.length > 0 
        ? event.locations.map(loc => loc.name).join(', ')
        : 'Не указано';
      
      // Определяем тип участников
      const participantTypeMap = {
        'all': 'Все',
        'registration': 'По записи',
        'manual': 'Вручную'
      };
      const participantType = participantTypeMap[event.participant_type] || 'Не указано';
      
      // Получаем названия групп участников
      const groupNames = event.group_tags_data && event.group_tags_data.length > 0
        ? event.group_tags_data.map(group => group.name).join(', ')
        : 'Не указано';
      
      return {
        'Время начала': startTime,
        'Время окончания': endTime,
        'Название': event.name,
        'Локация': locationNames,
        'Тип участников': participantType,
        'Группы участников': groupNames
      };
    });

    // Создаем CSV строку
    const headers = ['Время начала', 'Время окончания', 'Название', 'Локация', 'Тип участников', 'Группы участников'];
    const csvContent = [
      headers.join('\t'),
      ...csvData.map(row => headers.map(header => (row as any)[header] || '').join('\t'))
    ].join('\n');

    // Создаем и скачиваем файл
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `мероприятия_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-gray-900">Мероприятия</h2>
        </div>
      </header>

      {/* Поиск и фильтры */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск мероприятий..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <span>Теги ({selectedTags.length})</span>
            <IconChevronDown size={16} className={`transition-transform ${isTagDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isTagDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg z-10">
              <div className="p-2">
                {eventTags.map(tag => (
                  <label key={tag.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag.id)}
                      onChange={() => handleTagToggle(tag.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{tag.name}</span>
                  </label>
                ))}
                {eventTags.length === 0 && (
                  <div className="p-2 text-sm text-gray-500">Теги не найдены</div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <span className="text-xs text-gray-500 whitespace-nowrap">
          Показано: {filteredEvents.length}
        </span>
      </div>

      {/* Кнопки действий */}
      <div className="flex justify-start gap-3">
        <button
          onClick={() => openEditModal()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <IconPlus size={16} />
          Добавить мероприятие
        </button>
        
        <button
          onClick={exportEventsToCSV}
          disabled={filteredEvents.length === 0}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <IconArrowDownTray size={16} />
          Экспорт в таблицу
        </button>
      </div>

      {/* Список мероприятий */}
      {isLoading ? (
        <EventsLoadingSkeleton />
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => {
            const isExpanded = expandedEvents.has(event.id);
            const displayTags = isExpanded ? event.tags_data : event.tags_data.slice(0, 3);
            const hasMoreTags = event.tags_data.length > 3;

            return (
              <div
                key={event.id}
                onClick={() => openEditModal(event)}
                className={`rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:border-gray-300 ${
                  isExpanded ? 'min-h-[120px]' : 'min-h-[80px]'
                }`}
              >
                <div className="flex items-start justify-between h-full">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Время */}
                    <div className="text-sm text-gray-600 flex-shrink-0 mt-1">
                      <span className="whitespace-nowrap">{formatEventTime(event.start_time, event.end_time)}</span>
                    </div>
                    
                    {/* Основной контент */}
                    <div className="flex-1 min-w-0">
                      {/* Название и локация */}
                      <div className="flex items-start gap-4 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 leading-tight flex-1">{event.name}</h3>
                        {event.locations && event.locations.length > 0 && (
                          <div className="text-xs text-gray-500 flex-shrink-0">
                            <span className="whitespace-nowrap">
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
                      
                      {/* Теги */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {displayTags.length > 0 && displayTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {tag.name}
                          </span>
                        ))}
                        {hasMoreTags && !isExpanded && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleEventExpansion(event.id);
                            }}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                          >
                            <IconEllipsisHorizontal size={12} />
                          </button>
                        )}
                        {isExpanded && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleEventExpansion(event.id);
                            }}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                          >
                            Скрыть
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Действия */}
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(event);
                      }}
                      className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title="Редактировать"
                    >
                      <IconPencil size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvent(event.id);
                      }}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Удалить"
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          
          {filteredEvents.length === 0 && !isLoading && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              {searchQuery || selectedTags.length > 0 
                ? "Подходящих мероприятий не найдено" 
                : "Мероприятия не найдены"
              }
            </div>
          )}
        </div>
      )}

      {/* Модальное окно редактирования */}
      <EventEditModal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        onSave={handleSaveEvent}
        event={editingEvent}
        eventTags={eventTags}
        participants={participants}
        locations={locations}
      />
    </div>
  );
};

export default AdminEventsPage;

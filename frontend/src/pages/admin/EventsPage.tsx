import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getEventsForEventum, createEvent, updateEvent, deleteEvent } from "../../api/event";
import { eventTagApi } from "../../api/eventTag";
import { groupTagApi } from "../../api/groupTag";
import { getLocationsForEventum } from "../../api/location";
import { getParticipantsForEventum } from "../../api/participant";
import { getGroupsForEventum } from "../../api/group";
import type { Event, EventTag, GroupTag, Location, Participant, ParticipantGroup } from "../../types";
import { 
  IconInformationCircle, 
  IconPencil, 
  IconTrash, 
  IconPlus, 
  IconEllipsisHorizontal,
  IconChevronDown
} from "../../components/icons";
import EventEditModal from "../../components/event/EventEditModal";

interface EventWithTags extends Event {
  tags_data: EventTag[];
  group_tags_data?: GroupTag[];
}

const AdminEventsPage = () => {
  const { eventumSlug } = useParams();
  const [events, setEvents] = useState<EventWithTags[]>([]);
  const [eventTags, setEventTags] = useState<EventTag[]>([]);
  const [groupTags, setGroupTags] = useState<GroupTag[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantGroups, setParticipantGroups] = useState<ParticipantGroup[]>([]);
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
      let groupTagsData: GroupTag[] = [];
      let locationsData: Location[] = [];
      let participantsData: Participant[] = [];
      let participantGroupsData: ParticipantGroup[] = [];
      
      try {
        tagsData = await eventTagApi.getEventTags(eventumSlug);
      } catch (tagError) {
        console.error('Ошибка загрузки тегов:', tagError);
        // Продолжаем работу без тегов
      }
      
      try {
        groupTagsData = await groupTagApi.getGroupTags(eventumSlug);
      } catch (groupTagError) {
        console.error('Ошибка загрузки тегов групп:', groupTagError);
        // Продолжаем работу без тегов групп
      }
      
      try {
        participantsData = await getParticipantsForEventum(eventumSlug);
      } catch (participantError) {
        console.error('Ошибка загрузки участников:', participantError);
        // Продолжаем работу без участников
      }
      
      try {
        participantGroupsData = await getGroupsForEventum(eventumSlug);
      } catch (groupError) {
        console.error('Ошибка загрузки групп участников:', groupError);
        // Продолжаем работу без групп
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
      setGroupTags(groupTagsData);
      setLocations(locationsData);
      setParticipants(participantsData);
      setParticipantGroups(participantGroupsData);
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
    location_id?: number;
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


  const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-gray-900">Мероприятия</h2>
          <div className="group relative">
            <IconInformationCircle size={20} className="text-gray-400 cursor-help" />
            <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-normal w-80 z-50">
              Тут будет полезная подсказка.
            </div>
          </div>
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

      {/* Кнопка добавления мероприятия */}
      <div className="flex justify-start">
        <button
          onClick={() => openEditModal()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <IconPlus size={16} />
          Добавить мероприятие
        </button>
      </div>

      {/* Список мероприятий */}
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => {
            const isExpanded = expandedEvents.has(event.id);
            const displayTags = isExpanded ? event.tags_data : event.tags_data.slice(0, 3);
            const hasMoreTags = event.tags_data.length > 3;

            return (
              <div
                key={event.id}
                className={`rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 ${
                  isExpanded ? 'min-h-[100px]' : 'h-16'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Время */}
                    <div className="text-sm text-gray-600 flex-shrink-0">
                      <span className="whitespace-nowrap">{formatEventTime(event.start_time, event.end_time)}</span>
                    </div>
                    
                    {/* Название */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">{event.name}</h3>
                    </div>
                    
                    {/* Теги */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        {displayTags.length > 0 ? (
                          displayTags.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {tag.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">Нет тегов</span>
                        )}
                        {hasMoreTags && !isExpanded && (
                          <button
                            onClick={() => toggleEventExpansion(event.id)}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                          >
                            <IconEllipsisHorizontal size={12} />
                          </button>
                        )}
                        {isExpanded && (
                          <button
                            onClick={() => toggleEventExpansion(event.id)}
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
                      onClick={() => openEditModal(event)}
                      className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      title="Редактировать"
                    >
                      <IconPencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
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
        groupTags={groupTags}
        participants={participants}
        participantGroups={participantGroups}
        locations={locations}
      />
    </div>
  );
};

export default AdminEventsPage;

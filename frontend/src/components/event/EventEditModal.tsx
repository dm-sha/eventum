import { useState, useRef, useEffect, useCallback } from "react";
import type { Event, EventTag, GroupTag, Location, Participant, ParticipantGroup, ParticipantType } from "../../types";
import { LocationSelector } from "../location/LocationSelector";

// Компонент для вкладки "Общее"
const GeneralTab = ({ 
  eventForm, 
  setEventForm, 
  tagSearchQuery, 
  setTagSearchQuery, 
  showTagSuggestions, 
  setShowTagSuggestions, 
  eventTags, 
  locations, 
  getTagSuggestions, 
  addTagToForm, 
  removeTagFromForm, 
  getEndTimeFromStartTime,
  tagInputRef
}: {
  eventForm: any;
  setEventForm: any;
  tagSearchQuery: string;
  setTagSearchQuery: (query: string) => void;
  showTagSuggestions: boolean;
  setShowTagSuggestions: (show: boolean) => void;
  eventTags: EventTag[];
  locations: Location[];
  getTagSuggestions: () => EventTag[];
  addTagToForm: (tag: EventTag) => void;
  removeTagFromForm: (tagId: number) => void;
  getEndTimeFromStartTime: (startTime: string) => string;
  tagInputRef: React.RefObject<HTMLDivElement | null>;
}) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Название *
      </label>
      <input
        type="text"
        value={eventForm.name}
        onChange={(e) => setEventForm((prev: any) => ({ ...prev, name: e.target.value }))}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        placeholder="Введите название мероприятия"
      />
    </div>
    
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Описание
      </label>
      <textarea
        value={eventForm.description}
        onChange={(e) => setEventForm((prev: any) => ({ ...prev, description: e.target.value }))}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        rows={3}
        placeholder="Введите описание мероприятия"
      />
    </div>
    
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        URL изображения
      </label>
      <input
        type="url"
        value={eventForm.image_url}
        onChange={(e) => setEventForm((prev: any) => ({ ...prev, image_url: e.target.value }))}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        placeholder="https://example.com/image.jpg"
      />
    </div>
    
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Начало *
        </label>
        <input
          type="datetime-local"
          value={eventForm.start_time}
          onChange={(e) => {
            const newStartTime = e.target.value;
            setEventForm((prev: any) => {
              const newEndTime = prev.end_time && new Date(prev.end_time) > new Date(newStartTime) 
                ? prev.end_time 
                : getEndTimeFromStartTime(newStartTime);
              return { 
                ...prev, 
                start_time: newStartTime,
                end_time: newEndTime
              };
            });
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Конец *
        </label>
        <input
          type="datetime-local"
          value={eventForm.end_time}
          onChange={(e) => setEventForm((prev: any) => ({ ...prev, end_time: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
    </div>
    
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Локация
      </label>
      <LocationSelector
        locations={locations}
        selectedLocationId={eventForm.location_id}
        onLocationChange={(locationId) => setEventForm((prev: any) => ({
          ...prev,
          location_id: locationId
        }))}
        placeholder="Выберите локацию (необязательно)"
      />
    </div>
    
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Теги
      </label>
      
      {/* Поиск тегов с саджестами */}
      <div ref={tagInputRef} className="relative mb-3">
        <input
          type="text"
          value={tagSearchQuery}
          onChange={(e) => setTagSearchQuery(e.target.value)}
          onFocus={() => {
            setShowTagSuggestions(true);
          }}
          onClick={() => {
            setShowTagSuggestions(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowTagSuggestions(false);
            }
          }}
          placeholder="Добавить тег..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        
        {/* Саджесты */}
        {showTagSuggestions && getTagSuggestions().length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-32 overflow-y-auto">
            {getTagSuggestions().map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => addTagToForm(tag)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
        
        {showTagSuggestions && tagSearchQuery.trim() && getTagSuggestions().length === 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="px-3 py-2 text-sm text-gray-500">
              Теги не найдены
            </div>
          </div>
        )}
      </div>
      
      {/* Показать выбранные теги */}
      {eventForm.tags.length > 0 && (
        <div>
          <div className="flex flex-wrap gap-1">
            {eventForm.tags.map((tagId: number) => {
              const tag = eventTags.find(t => t.id === tagId);
              return tag ? (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => removeTagFromForm(tagId)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  </div>
);

// Компонент для вкладки "Участники"
const ParticipantsTab = ({
  eventForm,
  setEventForm,
  participantSearchQuery,
  setParticipantSearchQuery,
  groupSearchQuery,
  setGroupSearchQuery,
  groupTagSearchQuery,
  setGroupTagSearchQuery,
  showParticipantSuggestions,
  setShowParticipantSuggestions,
  showGroupSuggestions,
  setShowGroupSuggestions,
  showGroupTagSuggestions,
  setShowGroupTagSuggestions,
  participants,
  participantGroups,
  groupTags,
  getParticipantSuggestions,
  addParticipantToForm,
  removeParticipantFromForm,
  getGroupSuggestions,
  addGroupToForm,
  removeGroupFromForm,
  getGroupTagSuggestions,
  addGroupTagToForm,
  removeGroupTagFromForm,
  getTotalParticipantsCount,
  participantInputRef,
  groupInputRef,
  groupTagInputRef
}: {
  eventForm: any;
  setEventForm: any;
  participantSearchQuery: string;
  setParticipantSearchQuery: (query: string) => void;
  groupSearchQuery: string;
  setGroupSearchQuery: (query: string) => void;
  groupTagSearchQuery: string;
  setGroupTagSearchQuery: (query: string) => void;
  showParticipantSuggestions: boolean;
  setShowParticipantSuggestions: (show: boolean) => void;
  showGroupSuggestions: boolean;
  setShowGroupSuggestions: (show: boolean) => void;
  showGroupTagSuggestions: boolean;
  setShowGroupTagSuggestions: (show: boolean) => void;
  participants: Participant[];
  participantGroups: ParticipantGroup[];
  groupTags: GroupTag[];
  getParticipantSuggestions: () => Participant[];
  addParticipantToForm: (participant: Participant) => void;
  removeParticipantFromForm: (participantId: number) => void;
  getGroupSuggestions: () => ParticipantGroup[];
  addGroupToForm: (group: ParticipantGroup) => void;
  removeGroupFromForm: (groupId: number) => void;
  getGroupTagSuggestions: () => GroupTag[];
  addGroupTagToForm: (groupTag: GroupTag) => void;
  removeGroupTagFromForm: (groupTagId: number) => void;
  getTotalParticipantsCount: () => number;
  participantInputRef: React.RefObject<HTMLDivElement | null>;
  groupInputRef: React.RefObject<HTMLDivElement | null>;
  groupTagInputRef: React.RefObject<HTMLDivElement | null>;
}) => (
  <div className="space-y-4">
    {/* Выбор типа участников */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Тип участников
      </label>
      <div className="space-y-2">
        <label className="flex items-center">
          <input
            type="radio"
            name="participant_type"
            value="all"
            checked={eventForm.participant_type === 'all'}
            onChange={(e) => setEventForm((prev: any) => ({ 
              ...prev, 
              participant_type: e.target.value,
              max_participants: undefined,
              participants: [],
              groups: [],
              group_tags: []
            }))}
            className="mr-2"
          />
          <span className="text-sm">Для всех</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name="participant_type"
            value="registration"
            checked={eventForm.participant_type === 'registration'}
            onChange={(e) => setEventForm((prev: any) => ({ 
              ...prev, 
              participant_type: e.target.value,
              participants: [],
              groups: [],
              group_tags: []
            }))}
            className="mr-2"
          />
          <span className="text-sm">По записи</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name="participant_type"
            value="manual"
            checked={eventForm.participant_type === 'manual'}
            onChange={(e) => setEventForm((prev: any) => ({ 
              ...prev, 
              participant_type: e.target.value,
              max_participants: undefined
            }))}
            className="mr-2"
          />
          <span className="text-sm">Вручную</span>
        </label>
      </div>
    </div>

    {/* Поле для максимального количества участников (только для типа registration) */}
    {eventForm.participant_type === 'registration' && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Максимальное количество участников *
        </label>
        <input
          type="number"
          min="1"
          value={eventForm.max_participants || ''}
          onChange={(e) => setEventForm((prev: any) => ({ 
            ...prev, 
            max_participants: e.target.value ? parseInt(e.target.value) : undefined 
          }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="Введите максимальное количество участников"
        />
      </div>
    )}

    {/* Информация о количестве участников для ручного режима */}
    {eventForm.participant_type === 'manual' && (
      <div className="p-3 bg-gray-50 rounded-lg">
        <div className="text-sm text-gray-600">
          <strong>Общее количество участников:</strong> {getTotalParticipantsCount()}
        </div>
      </div>
    )}

    {/* Поля для ручного режима */}
    {eventForm.participant_type === 'manual' && (
      <>
        {/* Выбор участников по прямой связи */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Участники
          </label>
          
          <div ref={participantInputRef} className="relative mb-3">
            <input
              type="text"
              value={participantSearchQuery}
              onChange={(e) => setParticipantSearchQuery(e.target.value)}
              onFocus={() => setShowParticipantSuggestions(true)}
              onClick={() => setShowParticipantSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowParticipantSuggestions(false);
                }
              }}
              placeholder="Добавить участника..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            
            {showParticipantSuggestions && getParticipantSuggestions().length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-32 overflow-y-auto">
                {getParticipantSuggestions().map((participant) => (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => addParticipantToForm(participant)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {participant.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {eventForm.participants.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {eventForm.participants.map((participantId: number) => {
                const participant = participants.find(p => p.id === participantId);
                return participant ? (
                  <span
                    key={participantId}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                  >
                    {participant.name}
                    <button
                      type="button"
                      onClick={() => removeParticipantFromForm(participantId)}
                      className="ml-1 text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Выбор групп */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Группы участников
          </label>
          
          <div ref={groupInputRef} className="relative mb-3">
            <input
              type="text"
              value={groupSearchQuery}
              onChange={(e) => setGroupSearchQuery(e.target.value)}
              onFocus={() => setShowGroupSuggestions(true)}
              onClick={() => setShowGroupSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowGroupSuggestions(false);
                }
              }}
              placeholder="Добавить группу..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            
            {showGroupSuggestions && getGroupSuggestions().length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-32 overflow-y-auto">
                {getGroupSuggestions().map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => addGroupToForm(group)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {group.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {eventForm.groups.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {eventForm.groups.map((groupId: number) => {
                const group = participantGroups.find(g => g.id === groupId);
                return group ? (
                  <span
                    key={groupId}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
                  >
                    {group.name}
                    <button
                      type="button"
                      onClick={() => removeGroupFromForm(groupId)}
                      className="ml-1 text-orange-600 hover:text-orange-800"
                    >
                      ×
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Теги групп */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Теги групп
          </label>
          
          <div ref={groupTagInputRef} className="relative mb-3">
            <input
              type="text"
              value={groupTagSearchQuery}
              onChange={(e) => setGroupTagSearchQuery(e.target.value)}
              onFocus={() => setShowGroupTagSuggestions(true)}
              onClick={() => setShowGroupTagSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowGroupTagSuggestions(false);
                }
              }}
              placeholder="Добавить тег группы..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            
            {showGroupTagSuggestions && getGroupTagSuggestions().length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-32 overflow-y-auto">
                {getGroupTagSuggestions().map((groupTag) => (
                  <button
                    key={groupTag.id}
                    type="button"
                    onClick={() => addGroupTagToForm(groupTag)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {groupTag.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {eventForm.group_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {eventForm.group_tags.map((groupTagId: number) => {
                const groupTag = groupTags.find(gt => gt.id === groupTagId);
                return groupTag ? (
                  <span
                    key={groupTagId}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                  >
                    {groupTag.name}
                    <button
                      type="button"
                      onClick={() => removeGroupTagFromForm(groupTagId)}
                      className="ml-1 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>
      </>
    )}
  </div>
);

interface EventEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: {
    name: string;
    description: string;
    start_time: string;
    end_time: string;
    participant_type: ParticipantType;
    max_participants?: number;
    image_url?: string;
    participants?: number[];
    groups?: number[];
    tags?: number[];
    tag_ids?: number[];
    group_tags?: number[];
    group_tag_ids?: number[];
    location_id?: number;
  }) => Promise<void>;
  event?: Event | null;
  eventTags: EventTag[];
  groupTags: GroupTag[];
  participants: Participant[];
  participantGroups: ParticipantGroup[];
  locations: Location[];
  title?: string;
}

const EventEditModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  event, 
  eventTags, 
  groupTags,
  participants,
  participantGroups,
  locations,
  title 
}: EventEditModalProps) => {
  const [activeTab, setActiveTab] = useState<'general' | 'participants'>('general');
  const [eventForm, setEventForm] = useState({
    name: "",
    description: "",
    start_time: "",
    end_time: "",
    participant_type: 'all' as ParticipantType,
    max_participants: undefined as number | undefined,
    image_url: "",
    participants: [] as number[],
    groups: [] as number[],
    tags: [] as number[],
    group_tags: [] as number[],
    location_id: undefined as number | undefined
  });
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [groupTagSearchQuery, setGroupTagSearchQuery] = useState("");
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showGroupTagSuggestions, setShowGroupTagSuggestions] = useState(false);
  const [showParticipantSuggestions, setShowParticipantSuggestions] = useState(false);
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const tagInputRef = useRef<HTMLDivElement>(null);
  const groupTagInputRef = useRef<HTMLDivElement>(null);
  const participantInputRef = useRef<HTMLDivElement>(null);
  const groupInputRef = useRef<HTMLDivElement>(null);


  // Обработка кликов вне области ввода
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagInputRef.current && !tagInputRef.current.contains(event.target as Node)) {
        setShowTagSuggestions(false);
      }
      if (groupTagInputRef.current && !groupTagInputRef.current.contains(event.target as Node)) {
        setShowGroupTagSuggestions(false);
      }
      if (participantInputRef.current && !participantInputRef.current.contains(event.target as Node)) {
        setShowParticipantSuggestions(false);
      }
      if (groupInputRef.current && !groupInputRef.current.contains(event.target as Node)) {
        setShowGroupSuggestions(false);
      }
    };

    if (showTagSuggestions || showGroupTagSuggestions || showParticipantSuggestions || showGroupSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTagSuggestions, showGroupTagSuggestions, showParticipantSuggestions, showGroupSuggestions]);

  // Инициализация формы при открытии
  useEffect(() => {
    if (isOpen) {
      if (event) {
        // Извлекаем ID из объектов тегов, участников, групп и локации
        const tagIds = event.tags.map(tag => tag.id);
        const groupTagIds = event.group_tags?.map(tag => tag.id) || [];
        const participantIds = (event.participants ?? []).map((p: any) => typeof p === 'number' ? p : p.id);
        const groupIds = (event.groups ?? []).map((g: any) => typeof g === 'number' ? g : g.id);
        const locationId = event.location?.id || event.location_id;
        setEventForm({
          name: event.name,
          description: event.description,
          start_time: formatDateTimeForInput(event.start_time),
          end_time: formatDateTimeForInput(event.end_time),
          participant_type: event.participant_type || 'all',
          max_participants: event.max_participants,
          image_url: event.image_url || "",
          participants: participantIds,
          groups: groupIds,
          tags: tagIds,
          group_tags: groupTagIds,
          location_id: locationId
        });
      } else {
        setEventForm({
          name: "",
          description: "",
          start_time: getDefaultDateTime(),
          end_time: getDefaultEndDateTime(),
          participant_type: 'all',
          max_participants: undefined,
          image_url: "",
          participants: [],
          groups: [],
          tags: [],
          group_tags: [],
          location_id: undefined
        });
      }
      setTagSearchQuery("");
      setGroupTagSearchQuery("");
      setParticipantSearchQuery("");
      setGroupSearchQuery("");
      setShowTagSuggestions(false);
      setShowGroupTagSuggestions(false);
      setShowParticipantSuggestions(false);
      setShowGroupSuggestions(false);
    }
  }, [isOpen, event]);

  const formatDateTimeForInput = (dateTime: string) => {
    if (!dateTime) return "";
    const date = new Date(dateTime);
    // Используем локальное время для datetime-local без конвертации в UTC
    return formatLocalDateTime(date);
  };

  // Функция для форматирования даты в локальном времени для datetime-local
  const formatLocalDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getDefaultDateTime = () => {
    const now = new Date();
    // Устанавливаем время на начало текущего часа
    now.setMinutes(0, 0, 0);
    return formatLocalDateTime(now);
  };

  const getDefaultEndDateTime = () => {
    const now = new Date();
    // Устанавливаем время на час вперед от начала текущего часа
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    return formatLocalDateTime(now);
  };

  const getEndTimeFromStartTime = useCallback((startTime: string) => {
    if (!startTime) return "";
    const startDate = new Date(startTime);
    // Добавляем час к времени начала
    startDate.setHours(startDate.getHours() + 1);
    return formatLocalDateTime(startDate);
  }, []);

  const addTagToForm = useCallback((tag: EventTag) => {
    if (!eventForm.tags.includes(tag.id)) {
      setEventForm(prev => ({
        ...prev,
        tags: [...prev.tags, tag.id]
      }));
    }
    setTagSearchQuery("");
    setShowTagSuggestions(false);
  }, [eventForm.tags]);

  const removeTagFromForm = useCallback((tagId: number) => {
    setEventForm(prev => ({
      ...prev,
      tags: prev.tags.filter(id => id !== tagId)
    }));
  }, []);

  const getTagSuggestions = useCallback(() => {
    const filteredTags = eventTags.filter(tag => 
      !eventForm.tags.includes(tag.id) &&
      (!tagSearchQuery.trim() || tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase()))
    );
    
    return filteredTags.slice(0, 5);
  }, [eventTags, eventForm.tags, tagSearchQuery]);

  const addGroupTagToForm = useCallback((groupTag: GroupTag) => {
    if (!eventForm.group_tags.includes(groupTag.id)) {
      setEventForm(prev => ({
        ...prev,
        group_tags: [...prev.group_tags, groupTag.id]
      }));
    }
    setGroupTagSearchQuery("");
    setShowGroupTagSuggestions(false);
  }, [eventForm.group_tags]);

  const removeGroupTagFromForm = useCallback((groupTagId: number) => {
    setEventForm(prev => ({
      ...prev,
      group_tags: prev.group_tags.filter(id => id !== groupTagId)
    }));
  }, []);

  const getGroupTagSuggestions = useCallback(() => {
    const filteredGroupTags = groupTags.filter(groupTag => 
      !eventForm.group_tags.includes(groupTag.id) &&
      (!groupTagSearchQuery.trim() || groupTag.name.toLowerCase().includes(groupTagSearchQuery.toLowerCase()))
    );
    
    return filteredGroupTags.slice(0, 5);
  }, [groupTags, eventForm.group_tags, groupTagSearchQuery]);

  // Функции для работы с участниками
  const addParticipantToForm = useCallback((participant: Participant) => {
    if (!eventForm.participants.includes(participant.id)) {
      setEventForm(prev => ({
        ...prev,
        participants: [...prev.participants, participant.id]
      }));
    }
    setParticipantSearchQuery("");
    setShowParticipantSuggestions(false);
  }, [eventForm.participants]);

  const removeParticipantFromForm = useCallback((participantId: number) => {
    setEventForm(prev => ({
      ...prev,
      participants: prev.participants.filter(id => id !== participantId)
    }));
  }, []);

  const getParticipantSuggestions = useCallback(() => {
    const filteredParticipants = participants.filter(participant => 
      !eventForm.participants.includes(participant.id) &&
      (!participantSearchQuery.trim() || participant.name.toLowerCase().includes(participantSearchQuery.toLowerCase()))
    );
    
    return filteredParticipants.slice(0, 5);
  }, [participants, eventForm.participants, participantSearchQuery]);

  // Функции для работы с группами
  const addGroupToForm = useCallback((group: ParticipantGroup) => {
    if (!eventForm.groups.includes(group.id)) {
      setEventForm(prev => ({
        ...prev,
        groups: [...prev.groups, group.id]
      }));
    }
    setGroupSearchQuery("");
    setShowGroupSuggestions(false);
  }, [eventForm.groups]);

  const removeGroupFromForm = useCallback((groupId: number) => {
    setEventForm(prev => ({
      ...prev,
      groups: prev.groups.filter(id => id !== groupId)
    }));
  }, []);

  const getGroupSuggestions = useCallback(() => {
    const filteredGroups = participantGroups.filter(group => 
      !eventForm.groups.includes(group.id) &&
      (!groupSearchQuery.trim() || group.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))
    );
    
    return filteredGroups.slice(0, 5);
  }, [participantGroups, eventForm.groups, groupSearchQuery]);

  // Подсчет общего количества участников для ручного режима
  const getTotalParticipantsCount = useCallback(() => {
    const participantIds = new Set<number>();
    
    // Участники по прямой связи
    eventForm.participants.forEach(id => participantIds.add(id));
    
    // Участники через группы
    eventForm.groups.forEach(groupId => {
      const group = participantGroups.find(g => g.id === groupId);
      if (group) {
        group.participants.forEach(id => participantIds.add(id));
      }
    });
    
    // Участники через теги групп
    eventForm.group_tags.forEach(groupTagId => {
      const groupTag = groupTags.find(gt => gt.id === groupTagId);
      if (groupTag) {
        // Находим все группы с этим тегом
        const groupsWithTag = participantGroups.filter(g => 
          g.tags.some(tag => tag.id === groupTagId)
        );
        groupsWithTag.forEach(group => {
          group.participants.forEach(id => participantIds.add(id));
        });
      }
    });
    
    return participantIds.size;
  }, [eventForm.participants, eventForm.groups, eventForm.group_tags, participantGroups, groupTags]);

  const handleSave = async () => {
    if (!eventForm.name.trim() || !eventForm.start_time || !eventForm.end_time) return;
    
    // Валидация дат
    if (new Date(eventForm.end_time) <= new Date(eventForm.start_time)) {
      return;
    }
    
    // Валидация для типа registration
    if (eventForm.participant_type === 'registration' && (!eventForm.max_participants || eventForm.max_participants <= 0)) {
      return;
    }
    
    setIsSaving(true);
    try {
      // Преобразуем tags в tag_ids для backend
      const eventData = {
        name: eventForm.name,
        description: eventForm.description,
        start_time: eventForm.start_time,
        end_time: eventForm.end_time,
        participant_type: eventForm.participant_type,
        max_participants: eventForm.max_participants,
        image_url: eventForm.image_url || undefined,
        participants: eventForm.participants,
        groups: eventForm.groups,
        location_id: eventForm.location_id,
        tag_ids: eventForm.tags,
        group_tag_ids: eventForm.group_tags
      };
      await onSave(eventData);
      onClose();
    } catch (error) {
      console.error('Ошибка сохранения мероприятия:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = eventForm.name.trim() && 
    eventForm.start_time && 
    eventForm.end_time &&
    new Date(eventForm.end_time) > new Date(eventForm.start_time) &&
    (eventForm.participant_type !== 'registration' || (eventForm.max_participants && eventForm.max_participants > 0));



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
      <div className="w-full max-w-2xl mx-4 bg-white rounded-xl shadow-lg pointer-events-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {title || (event ? 'Редактировать мероприятие' : 'Добавить мероприятие')}
          </h3>
          
          {/* Вкладки */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('general')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'general'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Общее
                </button>
                <button
                  onClick={() => setActiveTab('participants')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'participants'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Участники
                </button>
              </nav>
            </div>
          </div>
          
          {/* Содержимое вкладок */}
          {activeTab === 'general' ? (
            <GeneralTab 
              eventForm={eventForm}
              setEventForm={setEventForm}
              tagSearchQuery={tagSearchQuery}
              setTagSearchQuery={setTagSearchQuery}
              showTagSuggestions={showTagSuggestions}
              setShowTagSuggestions={setShowTagSuggestions}
              eventTags={eventTags}
              locations={locations}
              getTagSuggestions={getTagSuggestions}
              addTagToForm={addTagToForm}
              removeTagFromForm={removeTagFromForm}
              getEndTimeFromStartTime={getEndTimeFromStartTime}
              tagInputRef={tagInputRef}
            />
          ) : (
            <ParticipantsTab 
              eventForm={eventForm}
              setEventForm={setEventForm}
              participantSearchQuery={participantSearchQuery}
              setParticipantSearchQuery={setParticipantSearchQuery}
              groupSearchQuery={groupSearchQuery}
              setGroupSearchQuery={setGroupSearchQuery}
              groupTagSearchQuery={groupTagSearchQuery}
              setGroupTagSearchQuery={setGroupTagSearchQuery}
              showParticipantSuggestions={showParticipantSuggestions}
              setShowParticipantSuggestions={setShowParticipantSuggestions}
              showGroupSuggestions={showGroupSuggestions}
              setShowGroupSuggestions={setShowGroupSuggestions}
              showGroupTagSuggestions={showGroupTagSuggestions}
              setShowGroupTagSuggestions={setShowGroupTagSuggestions}
              participants={participants}
              participantGroups={participantGroups}
              groupTags={groupTags}
              getParticipantSuggestions={getParticipantSuggestions}
              addParticipantToForm={addParticipantToForm}
              removeParticipantFromForm={removeParticipantFromForm}
              getGroupSuggestions={getGroupSuggestions}
              addGroupToForm={addGroupToForm}
              removeGroupFromForm={removeGroupFromForm}
              getGroupTagSuggestions={getGroupTagSuggestions}
              addGroupTagToForm={addGroupTagToForm}
              removeGroupTagFromForm={removeGroupTagFromForm}
              getTotalParticipantsCount={getTotalParticipantsCount}
              participantInputRef={participantInputRef}
              groupInputRef={groupInputRef}
              groupTagInputRef={groupTagInputRef}
            />
          )}
          
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={!isFormValid || isSaving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventEditModal;

import { useState, useRef, useEffect, useCallback } from "react";
import { useEventumSlug } from "../../hooks/useEventumSlug";
import type { Event as EventModel, EventTag, GroupTag, Location, Participant, ParticipantGroup, ParticipantType, ValidationError, ParticipantGroupV2, CreateParticipantGroupV2Data, UpdateParticipantGroupV2Data } from "../../types";
import ParticipantGroupV2Editor from "../participantGroupV2/ParticipantGroupV2Editor";
import { groupsV2Api } from "../../api/eventumApi";
import { MultiLocationSelector } from "../location/MultiLocationSelector";

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
  tagInputRef,
  hasUserEditedEndTime,
  setHasUserEditedEndTime
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
  hasUserEditedEndTime: boolean;
  setHasUserEditedEndTime: (edited: boolean) => void;
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
              const newEndTime = !hasUserEditedEndTime
                ? getEndTimeFromStartTime(newStartTime)
                : prev.end_time;
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
          onChange={(e) => {
            setHasUserEditedEndTime(true);
            setEventForm((prev: any) => ({ ...prev, end_time: e.target.value }));
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
    </div>
    
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Локации
      </label>
      <MultiLocationSelector
        locations={locations}
        selectedLocationIds={eventForm.location_ids}
        onLocationChange={(locationIds) => setEventForm((prev: any) => ({
          ...prev,
          location_ids: locationIds
        }))}
        placeholder="Выберите локации"
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
          placeholder="Выберите тег"
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
        
        {showTagSuggestions && getTagSuggestions().length === 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="px-3 py-2 text-sm text-gray-500">
              {eventTags.length === 0
                ? 'Нет тегов'
                : (tagSearchQuery.trim() ? 'Теги не найдены' : 'Нет доступных тегов')}
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
  eventumSlug,
  eventGroupV2,
  setEventGroupV2,
  setSelectedEventGroupV2Id,
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
  groupTagInputRef,
  checkParticipantTypeValidation,
  participantTypeError,
  setParticipantTypeError,
  onEventGroupDraftChange,
  availableGroupsV2,
}: {
  eventForm: any;
  setEventForm: any;
  eventumSlug: string | undefined;
  eventGroupV2: ParticipantGroupV2 | null;
  setEventGroupV2: (g: ParticipantGroupV2 | null) => void;
  setSelectedEventGroupV2Id: (id: number | null) => void;
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
  checkParticipantTypeValidation: (newParticipantType: ParticipantType) => string | null;
  participantTypeError: string | null;
  setParticipantTypeError: (error: string | null) => void;
  onEventGroupDraftChange: (draft: { name: string; participant_relations: any[]; group_relations: any[] }) => void;
  availableGroupsV2: ParticipantGroupV2[];
}) => (
  <div className="space-y-4">
    {/* Информация о количестве участников (оценка): если нет включающих связей — участвуют все */}
    {/* Рендерим сам редактор групп V2 без собственных кнопок */}
    <div className="rounded-lg border border-gray-200 p-3">
      <ParticipantGroupV2Editor
        group={eventGroupV2}
        eventumSlug={eventumSlug || ''}
        nameOverride={(event as any) ? `Участники \"${(event as any).name}\"` : (eventForm.name ? `Участники \"${eventForm.name}\"` : '')}
        hideNameField
        hideActions
        onChange={onEventGroupDraftChange}
        onSave={async () => { /* сохранение выполняется кнопкой "Сохранить" модалки */ }}
        onCancel={() => { /* no-op */ }}
        isModal
        availableGroups={availableGroupsV2}
      />
    </div>
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
    location_ids?: number[];
  }) => Promise<void>;
  event?: EventModel | null;
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
  const eventumSlug = useEventumSlug();
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
    location_ids: [] as number[]
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
  const [validationErrors, setValidationErrors] = useState<ValidationError>({});
  const [participantTypeError, setParticipantTypeError] = useState<string | null>(null);
  const [hasUserEditedEndTime, setHasUserEditedEndTime] = useState(false);
  const [eventGroupV2, setEventGroupV2] = useState<ParticipantGroupV2 | null>(null);
  const [selectedEventGroupV2Id, setSelectedEventGroupV2Id] = useState<number | null>(null);
  const [eventGroupDraft, setEventGroupDraft] = useState<{
    name: string;
    participant_relations: { participant_id: number; relation_type: any }[];
    group_relations: { target_group_id: number; relation_type: any }[];
  } | null>(null);
  const [allGroupsV2, setAllGroupsV2] = useState<ParticipantGroupV2[]>([]);
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
        // Извлекаем ID из объектов тегов, участников, групп и локаций
        const tagIds = event.tags.map(tag => tag.id);
        const groupTagIds = event.group_tags?.map(tag => tag.id) || [];
        const participantIds = (event.participants ?? []).map((p: any) => typeof p === 'number' ? p : p.id);
        const groupIds = (event.groups ?? []).map((g: any) => typeof g === 'number' ? g : g.id);
        const locationIds = event.locations?.map(loc => loc.id) || event.location_ids || [];
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
          location_ids: locationIds
        });
        // Устанавливаем связанную V2 группу, если она есть в событии
        try {
          const evAny: any = event as any;
          if (evAny.event_group_v2 && evAny.event_group_v2.id) {
            const gid = evAny.event_group_v2.id as number;
            setSelectedEventGroupV2Id(gid);
            // Загружаем полную группу (c relations) из списка
            (async () => {
              try {
                if (eventumSlug) {
                  const resp = await groupsV2Api.getAll(eventumSlug, { includeEventGroups: true });
                  const groups = (resp as any).data ?? resp;
                  const found = (groups as any[]).find(g => g.id === gid) || null;
                  setEventGroupV2(found);
                } else {
                  setEventGroupV2(null);
                }
              } catch {
                setEventGroupV2(null);
              }
            })();
          } else {
            setEventGroupV2(null);
            setSelectedEventGroupV2Id(null);
          }
        } catch {
          setEventGroupV2(null);
          setSelectedEventGroupV2Id(null);
        }
      } else {
        // Попытаться подставить дату и время последнего созданного мероприятия из localStorage
        let start = getDefaultDateTime();
        let end = getDefaultEndDateTime();
        try {
          if (eventumSlug) {
            const lastStart = localStorage.getItem(`eventum:${eventumSlug}:lastEventStart`);
            if (lastStart) {
              // Если сохранено полное значение YYYY-MM-DDTHH:mm — используем его целиком
              if (lastStart.includes('T')) {
                start = lastStart;
              } else {
                // Обратная совместимость: если сохранена только дата
                const now = new Date();
                now.setMinutes(0, 0, 0);
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                start = `${lastStart}T${hours}:${minutes}`;
              }
              // Конец — +1 час от старта
              end = getEndTimeFromStartTime(start);
            }
          }
        } catch {}

        setEventForm({
          name: "",
          description: "",
          start_time: start,
          end_time: end,
          participant_type: 'all',
          max_participants: undefined,
          image_url: "",
          participants: [],
          groups: [],
          tags: [],
          group_tags: [],
          location_ids: []
        });
        setEventGroupV2(null);
        setSelectedEventGroupV2Id(null);
      }
      setTagSearchQuery("");
      setGroupTagSearchQuery("");
      setParticipantSearchQuery("");
      setGroupSearchQuery("");
      setShowTagSuggestions(false);
      setShowGroupTagSuggestions(false);
      setShowParticipantSuggestions(false);
      setShowGroupSuggestions(false);
      setValidationErrors({});
      setParticipantTypeError(null);
      setHasUserEditedEndTime(false);
      // Подгружаем все группы V2 для подсчета участников
      (async () => {
        try {
          if (eventumSlug) {
            const resp = await groupsV2Api.getAll(eventumSlug, { includeEventGroups: true });
            const groups = (resp as any).data ?? resp;
            setAllGroupsV2(groups as ParticipantGroupV2[]);
          } else {
            setAllGroupsV2([]);
          }
        } catch {
          setAllGroupsV2([]);
        }
      })();
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
    // Очищаем ошибки валидации при изменении связей
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.participant_type;
      return newErrors;
    });
    setParticipantTypeError(null);
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
    // Очищаем ошибки валидации при изменении связей
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.participant_type;
      return newErrors;
    });
    setParticipantTypeError(null);
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
    // Очищаем ошибки валидации при изменении связей
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.participant_type;
      return newErrors;
    });
    setParticipantTypeError(null);
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

  // Проверка валидации для изменения participant_type
  const checkParticipantTypeValidation = useCallback((newParticipantType: ParticipantType) => {
    // Если событие существует и пытаемся изменить с manual на другой тип
    if (event && event.participant_type === 'manual' && newParticipantType !== 'manual') {
      const hasBlockingConnections = 
        eventForm.participants.length > 0 || 
        eventForm.groups.length > 0 || 
        eventForm.group_tags.length > 0;
      
      if (hasBlockingConnections) {
        return "Нельзя изменить тип участников с 'manual' на другой тип, пока не удалены все связи с участниками, группами или тегами групп";
      }
    }
    return null;
  }, [event, eventForm.participants, eventForm.groups, eventForm.group_tags]);

  const handleSave = async () => {
    if (!eventForm.name.trim() || !eventForm.start_time || !eventForm.end_time) return;
    
    // Валидация дат
    if (new Date(eventForm.end_time) <= new Date(eventForm.start_time)) {
      return;
    }
    
    // Удалено: валидация для типа registration
    
    // Проверка валидации participant_type
    const participantTypeError = checkParticipantTypeValidation(eventForm.participant_type);
    if (participantTypeError) {
      setValidationErrors({ participant_type: participantTypeError });
      return;
    }
    
    // Очищаем ошибки валидации
    setValidationErrors({});
    
    setIsSaving(true);
    try {
      // Обеспечиваем сохранение/обновление группы V2 перед сохранением мероприятия
      let ensuredEventGroupId: number | null = selectedEventGroupV2Id;
      if (eventForm.participant_type !== 'all') {
        const draft = eventGroupDraft;
        const effectiveName = ((event as any) ? `Участники \"${(event as any).name}\"` : (eventForm.name ? `Участники \"${eventForm.name}\"` : '')).trim();
        if (effectiveName) {
          // Есть существующая группа — обновляем её, иначе создаём новую (если есть черновик или нужно пустую по умолчанию)
          if (eventGroupV2?.id) {
            const payload: any = { name: effectiveName };
            if (draft) {
              payload.participant_relations = draft.participant_relations;
              payload.group_relations = draft.group_relations;
            }
            try {
              const updatedResp = await groupsV2Api.update(eventGroupV2.id, { ...payload, is_event_group: true }, eventumSlug || undefined);
              const updated = (updatedResp as any).data ?? updatedResp;
              ensuredEventGroupId = (updated as any).id;
              setEventGroupV2(updated as any);
            } catch (e) {
              console.error('Ошибка обновления группы V2:', e);
            }
          } else {
            const createPayload: any = { name: effectiveName, is_event_group: true };
            if (draft) {
              createPayload.participant_relations = draft.participant_relations;
              createPayload.group_relations = draft.group_relations;
            }
            try {
              const createdResp = await groupsV2Api.create(createPayload, eventumSlug || undefined);
              const created = (createdResp as any).data ?? createdResp;
              ensuredEventGroupId = (created as any).id;
              setEventGroupV2(created as any);
              setSelectedEventGroupV2Id(ensuredEventGroupId);
            } catch (e) {
              console.error('Ошибка создания группы V2:', e);
            }
          }
        }
      }

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
        location_ids: eventForm.location_ids,
        tag_ids: eventForm.tags,
        group_tag_ids: eventForm.group_tags,
          // Если выбрана/создана группа V2 — передаем её ID для привязки после сохранения события
          event_group_v2_id: ensuredEventGroupId || undefined
      };
      await onSave(eventData);

      // Если создаём новое событие, сохраняем дату начала как последнюю использованную дату
      if (!event && eventumSlug) {
        try {
          // Сохраняем полное время начала в формате YYYY-MM-DDTHH:mm
          localStorage.setItem(`eventum:${eventumSlug}:lastEventStart`, eventForm.start_time);
        } catch {}
      }
      onClose();
    } catch (error: any) {
      console.error('Ошибка сохранения мероприятия:', error);
      
      // Обработка ошибок валидации с сервера
      if (error.response?.status === 400 && error.response?.data) {
        const serverErrors: ValidationError = {};
        
        // Обрабатываем ошибки валидации
        Object.keys(error.response.data).forEach(field => {
          const fieldError = error.response.data[field];
          if (Array.isArray(fieldError)) {
            serverErrors[field] = fieldError.join(' ');
          } else if (typeof fieldError === 'string') {
            serverErrors[field] = fieldError;
          }
        });
        
        // Специальная обработка ошибок валидации тегов
        if (serverErrors.tag_ids) {
          // Показываем ошибку валидации тегов как общую ошибку
          serverErrors.non_field_errors = serverErrors.non_field_errors || [];
          const tagError = Array.isArray(serverErrors.tag_ids) 
            ? serverErrors.tag_ids.join(' ')
            : serverErrors.tag_ids;
          
          if (Array.isArray(serverErrors.non_field_errors)) {
            serverErrors.non_field_errors.push(tagError);
          } else {
            serverErrors.non_field_errors = [serverErrors.non_field_errors, tagError];
          }
          // Убираем ошибку из поля tag_ids, чтобы не показывать её в интерфейсе тегов
          delete serverErrors.tag_ids;
        }
        
        // Специальная обработка ошибок валидации типа участников
        if (serverErrors.participant_type) {
          const participantTypeError = Array.isArray(serverErrors.participant_type)
            ? serverErrors.participant_type.join(' ')
            : serverErrors.participant_type;
          setParticipantTypeError(participantTypeError);
          
          // Также добавляем ошибку в общие ошибки, чтобы пользователь её увидел
          serverErrors.non_field_errors = serverErrors.non_field_errors || [];
          if (Array.isArray(serverErrors.non_field_errors)) {
            serverErrors.non_field_errors.push(participantTypeError);
          } else {
            serverErrors.non_field_errors = [serverErrors.non_field_errors, participantTypeError];
          }
          
          // Убираем ошибку из поля participant_type, чтобы не показывать её в интерфейсе поля
          delete serverErrors.participant_type;
        }
        
        setValidationErrors(serverErrors);
      } else {
        // Общая ошибка
        setValidationErrors({ 
          non_field_errors: ['Произошла ошибка при сохранении мероприятия'] 
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = eventForm.name.trim() && 
    eventForm.start_time && 
    eventForm.end_time &&
    new Date(eventForm.end_time) > new Date(eventForm.start_time);

  // ===== Подсчет количества участников по черновику/группе V2 =====
  const getGroupV2ById = useCallback((id: number) => allGroupsV2.find(g => g.id === id) || null, [allGroupsV2]);

  const collectParticipantsFromGroup = useCallback((groupId: number, visited: Set<number>): Set<number> => {
    const result = new Set<number>();
    const group = getGroupV2ById(groupId);
    if (!group || visited.has(groupId)) return result;
    visited.add(groupId);

    const inclusivePR = group.participant_relations.filter(r => r.relation_type === 'inclusive');
    const inclusiveGR = group.group_relations.filter(r => r.relation_type === 'inclusive');
    const exclusivePR = group.participant_relations.filter(r => r.relation_type === 'exclusive');
    const exclusiveGR = group.group_relations.filter(r => r.relation_type === 'exclusive');

    let base = new Set<number>();
    if (inclusivePR.length === 0 && inclusiveGR.length === 0) {
      // Все участники eventum как базовый набор
      participants.forEach(p => base.add(p.id));
      // Минус исключенные
      exclusivePR.forEach(r => base.delete(r.participant_id));
      exclusiveGR.forEach(r => {
        const sub = collectParticipantsFromGroup(r.target_group_id, new Set(visited));
        sub.forEach(pid => base.delete(pid));
      });
      return base;
    }

    // Иначе включения минус исключения
    inclusivePR.forEach(r => base.add(r.participant_id));
    inclusiveGR.forEach(r => {
      const sub = collectParticipantsFromGroup(r.target_group_id, new Set(visited));
      sub.forEach(pid => base.add(pid));
    });
    exclusivePR.forEach(r => base.delete(r.participant_id));
    exclusiveGR.forEach(r => {
      const sub = collectParticipantsFromGroup(r.target_group_id, new Set(visited));
      sub.forEach(pid => base.delete(pid));
    });
    return base;
  }, [participants, getGroupV2ById]);

  const collectParticipantsFromDraft = useCallback((): Set<number> => {
    if (!eventGroupDraft) return new Set<number>(participants.map(p => p.id));
    const inclusivePR = eventGroupDraft.participant_relations.filter(r => r.relation_type === 'inclusive');
    const inclusiveGR = eventGroupDraft.group_relations.filter(r => r.relation_type === 'inclusive');
    const exclusivePR = eventGroupDraft.participant_relations.filter(r => r.relation_type === 'exclusive');
    const exclusiveGR = eventGroupDraft.group_relations.filter(r => r.relation_type === 'exclusive');

    let base = new Set<number>();
    if (inclusivePR.length === 0 && inclusiveGR.length === 0) {
      participants.forEach(p => base.add(p.id));
      exclusivePR.forEach(r => base.delete(r.participant_id));
      exclusiveGR.forEach(r => {
        const sub = collectParticipantsFromGroup(r.target_group_id, new Set());
        sub.forEach(pid => base.delete(pid));
      });
      return base;
    }

    inclusivePR.forEach(r => base.add(r.participant_id));
    inclusiveGR.forEach(r => {
      const sub = collectParticipantsFromGroup(r.target_group_id, new Set());
      sub.forEach(pid => base.add(pid));
    });
    exclusivePR.forEach(r => base.delete(r.participant_id));
    exclusiveGR.forEach(r => {
      const sub = collectParticipantsFromGroup(r.target_group_id, new Set());
      sub.forEach(pid => base.delete(pid));
    });
    return base;
  }, [eventGroupDraft, participants, collectParticipantsFromGroup]);

  const participantsCount = (() => {
    if (eventGroupDraft) return collectParticipantsFromDraft().size;
    if (eventGroupV2?.id) return collectParticipantsFromGroup(eventGroupV2.id, new Set()).size;
    return participants.length; // по умолчанию: все
  })();



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
      <div className="w-full max-w-2xl mx-4 bg-white rounded-xl shadow-lg pointer-events-auto max-h-[90vh] flex flex-col">
        {/* Заголовок - фиксированный */}
        <div className="p-6 pb-0 flex-shrink-0">
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
          {activeTab === 'participants' && (
            <div className="text-sm text-gray-600 mb-2">Участников: {participantsCount}</div>
          )}
        </div>
        
        {/* Прокручиваемое содержимое */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
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
            hasUserEditedEndTime={hasUserEditedEndTime}
            setHasUserEditedEndTime={setHasUserEditedEndTime}
            />
          ) : (
            <ParticipantsTab 
              eventForm={eventForm}
              setEventForm={setEventForm}
              eventumSlug={eventumSlug}
              eventGroupV2={eventGroupV2}
              setEventGroupV2={setEventGroupV2}
              setSelectedEventGroupV2Id={setSelectedEventGroupV2Id}
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
              checkParticipantTypeValidation={checkParticipantTypeValidation}
              participantTypeError={participantTypeError}
              setParticipantTypeError={setParticipantTypeError}
              onEventGroupDraftChange={setEventGroupDraft}
              availableGroupsV2={allGroupsV2}
            />
          )}
          
          {/* Отображение общих ошибок валидации */}
          {validationErrors.non_field_errors && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-600">
                {Array.isArray(validationErrors.non_field_errors) 
                  ? validationErrors.non_field_errors.join(' ')
                  : validationErrors.non_field_errors
                }
              </div>
            </div>
          )}
        </div>
        
        {/* Кнопки - фиксированные внизу */}
        <div className="p-6 pt-4 flex-shrink-0 border-t border-gray-200">
          <div className="flex gap-3">
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

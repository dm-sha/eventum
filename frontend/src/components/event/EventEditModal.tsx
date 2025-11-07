import { useState, useRef, useEffect, useCallback } from "react";
import { useEventumSlug } from "../../hooks/useEventumSlug";
import type { Event as EventModel, EventTag, Location, Participant, ValidationError, ParticipantGroupV2 } from "../../types";
import ParticipantGroupV2Editor from "../participantGroupV2/ParticipantGroupV2Editor";
import { eventumApi } from "../../api/eventumApi";
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
  setHasUserEditedEndTime,
  onUpload,
  isUploading
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
  onUpload: (file: File) => void;
  isUploading: boolean;
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
        Изображение
      </label>
      <div className="mt-2">
        <div
          className="relative rounded-lg border-2 border-dashed border-gray-300 p-4 text-center hover:border-blue-400 transition-colors"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) onUpload(file);
          }}
        >
          <input
            id="event-image-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) onUpload(f);
              e.currentTarget.value = '';
            }}
          />
          <label
            htmlFor="event-image-upload"
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-600"><path d="M3.5 2A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14h4.879l-1.94 1.94a.75.75 0 101.06 1.06L10 14.5l2.5 2.5a.75.75 0 101.06-1.06L11.621 14H16.5A1.5 1.5 0 0018 12.5v-9A1.5 1.5 0 0016.5 2h-13z"/></svg>
            Выбрать файл
          </label>
          <div className="mt-2 text-xs text-gray-500">Перетащите изображение сюда или нажмите «Выбрать файл»</div>
          {isUploading && (
            <div className="mt-2 text-xs text-gray-500">Загрузка...</div>
          )}
        </div>
      </div>
      {eventForm.image_url && (
        <div className="mt-2">
          <img src={eventForm.image_url} alt="preview" className="max-h-32 rounded border" />
        </div>
      )}
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
  eventumSlug,
  localGroupState,
  onLocalGroupStateChange,
  availableGroupsV2,
  isLoadingGroupV2,
}: {
  eventForm: any;
  eventumSlug: string | undefined;
  localGroupState: ParticipantGroupV2 | null;
  onLocalGroupStateChange: (group: ParticipantGroupV2 | null) => void;
  availableGroupsV2: ParticipantGroupV2[];
  isLoadingGroupV2: boolean;
}) => {
  // Показываем загрузку ТОЛЬКО когда реально идет загрузка
  const showLoading = isLoadingGroupV2;
  
  // Простой обработчик изменений - просто обновляем состояние
  const handleEditorChange = (data: {
    name: string;
    participant_relations: { participant_id: number; relation_type: any }[];
    group_relations: { target_group_id: number; relation_type: any }[];
  }) => {
    if (localGroupState) {
      // Обновляем существующую группу
      const updatedGroup: ParticipantGroupV2 = {
        ...localGroupState,
        name: data.name,
        participant_relations: data.participant_relations.map((rel, idx) => ({
          id: localGroupState.participant_relations[idx]?.id || 0,
          relation_type: rel.relation_type,
          group_id: localGroupState.id,
          participant_id: rel.participant_id,
        })),
        group_relations: data.group_relations.map((rel, idx) => ({
          id: localGroupState.group_relations[idx]?.id || 0,
          relation_type: rel.relation_type,
          group_id: localGroupState.id,
          target_group_id: rel.target_group_id,
        })),
      };
      onLocalGroupStateChange(updatedGroup);
    } else {
      // Создаем новую группу (даже если нет relations - это нормально)
      const newGroup: ParticipantGroupV2 = {
        id: 0,
        name: data.name,
        is_event_group: true,
        participant_relations: data.participant_relations.map(rel => ({
          id: 0,
          relation_type: rel.relation_type,
          group_id: 0,
          participant_id: rel.participant_id,
        })),
        group_relations: data.group_relations.map(rel => ({
          id: 0,
          relation_type: rel.relation_type,
          group_id: 0,
          target_group_id: rel.target_group_id,
        })),
      };
      onLocalGroupStateChange(newGroup);
    }
  };
  
  return (
    <div className="space-y-4">
      {showLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-sm text-gray-600">Загрузка данных участников...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Информация о количестве участников (оценка): если нет включающих связей — участвуют все */}
          {/* Рендерим сам редактор групп V2 без собственных кнопок */}
          <div className="rounded-lg border border-gray-200 p-3">
            <ParticipantGroupV2Editor
              group={localGroupState}
              eventumSlug={eventumSlug || ''}
              nameOverride={eventForm.name ? `Участники \"${eventForm.name}\"` : ''}
              hideNameField
              hideActions
              onChange={handleEditorChange}
              onSave={async () => { /* сохранение выполняется кнопкой "Сохранить" модалки */ }}
              onCancel={() => { /* no-op */ }}
              isModal
              availableGroups={availableGroupsV2}
            />
          </div>
        </>
      )}
    </div>
  );
};

interface EventEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: {
    name: string;
    description: string;
    start_time: string;
    end_time: string;
    max_participants?: number;
    image_url?: string;
    participants?: number[];
    groups?: number[];
    tags?: number[];
    tag_ids?: number[];
    group_tags?: number[];
    group_tag_ids?: number[];
    location_ids?: number[];
    event_group_v2_id?: number | null;
  }) => Promise<void>;
  event?: EventModel | null;
  eventTags: EventTag[];
  participants: Participant[];
  locations: Location[];
  title?: string;
}

const EventEditModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  event, 
  eventTags, 
  participants,
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
    max_participants: undefined as number | undefined,
    image_url: "",
    participants: [] as number[],
    groups: [] as number[],
    tags: [] as number[],
    group_tags: [] as number[],
    location_ids: [] as number[]
  });
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError>({});
  const [hasUserEditedEndTime, setHasUserEditedEndTime] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  // Локальное состояние группы - используется для UI и подсчетов
  const [localGroupState, setLocalGroupState] = useState<ParticipantGroupV2 | null>(null);
  // Состояние группы на сервере - источник истины
  const [serverGroupState, setServerGroupState] = useState<ParticipantGroupV2 | null>(null);
  const [allGroupsV2, setAllGroupsV2] = useState<ParticipantGroupV2[]>([]);
  const [isLoadingGroupV2, setIsLoadingGroupV2] = useState(false);
  const tagInputRef = useRef<HTMLDivElement>(null);
  


  // Обработка кликов вне области ввода
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagInputRef.current && !tagInputRef.current.contains(event.target as Node)) {
        setShowTagSuggestions(false);
      }
    };

    if (showTagSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTagSuggestions]);

  // Инициализация формы при открытии
  useEffect(() => {
    if (!isOpen) return;
    
    // Сбрасываем состояние
    setIsLoadingGroupV2(false);
    setLocalGroupState(null);
    setServerGroupState(null);
    
    if (event) {
      // Извлекаем ID из объектов
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
        max_participants: event.max_participants,
        image_url: event.image_url || "",
        participants: participantIds,
        groups: groupIds,
        tags: tagIds,
        group_tags: groupTagIds,
        location_ids: locationIds
      });
      
      // Загружаем группу V2, если она есть
      const evAny: any = event as any;
      if (evAny.event_group_v2?.id && eventumSlug) {
        setIsLoadingGroupV2(true);
        groupsV2Api.getAll(eventumSlug, { includeEventGroups: true })
          .then((resp: any) => {
            const groups = resp.data ?? resp;
            const found = groups.find((g: any) => g.id === evAny.event_group_v2.id);
            if (found) {
              setServerGroupState(found);
              setLocalGroupState(found);
            }
          })
          .catch((error) => {
            console.error('Ошибка загрузки группы V2:', error);
          })
          .finally(() => {
            setIsLoadingGroupV2(false);
          });
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
          max_participants: undefined,
          image_url: "",
          participants: [],
          groups: [],
          tags: [],
          group_tags: [],
          location_ids: []
        });
        setServerGroupState(null);
        setLocalGroupState(null);
        setIsLoadingGroupV2(false);
    }
    
    // Общие действия для обоих случаев
    setTagSearchQuery("");
    setShowTagSuggestions(false);
    setValidationErrors({});
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
  }, [isOpen, event, eventumSlug]);

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

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file) return;
    if (!eventumSlug) return;
    try {
      setIsUploadingImage(true);
      const resp = await eventumApi.uploadImage(file, eventumSlug);
      const data: any = (resp as any).data ?? resp;
      if (data?.url) {
        setEventForm((prev: any) => ({ ...prev, image_url: data.url }));
      }
    } catch (e) {
      console.error('Ошибка загрузки изображения:', e);
    } finally {
      setIsUploadingImage(false);
    }
  }, [eventumSlug]);

  

  // Функции для работы с участниками (удалены неиспользуемые хелперы)

  // Функции для работы с группами (удалены неиспользуемые хелперы)

  // Подсчет общего количества участников для ручного режима (не используется)


  const handleSave = async () => {
    if (!eventForm.name.trim() || !eventForm.start_time || !eventForm.end_time) return;
    
    // Валидация дат
    if (new Date(eventForm.end_time) <= new Date(eventForm.start_time)) {
      return;
    }
    
    // Очищаем ошибки валидации
    setValidationErrors({});
    
    setIsSaving(true);
    try {
      // Сохраняем/обновляем группу V2 перед сохранением мероприятия
      let ensuredEventGroupId: number | null = null;
      
      // Утилита для сравнения групп - проверяет, изменились ли relations
      const areGroupsEqual = (local: ParticipantGroupV2 | null, server: ParticipantGroupV2 | null): boolean => {
        if (!local && !server) return true;
        if (!local || !server) return false;
        
        // Нормализуем relations для сравнения (сортируем и извлекаем только важные поля)
        const normalizeRelations = (relations: any[], type: 'participant' | 'group') => {
          return relations
            .map((rel: any) => ({
              type,
              id: type === 'participant' ? (rel.participant_id || rel.participant?.id || 0) : (rel.target_group_id || rel.target_group?.id || 0),
              relation: rel.relation_type
            }))
            .filter((r: any) => r.id > 0)
            .sort((a, b) => {
              const keyA = `${a.type}-${a.id}`;
              const keyB = `${b.type}-${b.id}`;
              return keyA.localeCompare(keyB);
            });
        };
        
        const localRelations = [
          ...normalizeRelations(local.participant_relations || [], 'participant'),
          ...normalizeRelations(local.group_relations || [], 'group')
        ];
        
        const serverRelations = [
          ...normalizeRelations(server.participant_relations || [], 'participant'),
          ...normalizeRelations(server.group_relations || [], 'group')
        ];
        
        if (localRelations.length !== serverRelations.length) return false;
        
        return JSON.stringify(localRelations) === JSON.stringify(serverRelations);
      };
      
      // Проверяем, нужно ли сохранять группу
      const hasLocalState = localGroupState !== null;
      const hasChanges = hasLocalState && !areGroupsEqual(localGroupState, serverGroupState);
      
      if (hasLocalState && (hasChanges || !serverGroupState)) {
        const effectiveName = ((event as any) ? `Участники \"${(event as any).name}\"` : (eventForm.name ? `Участники \"${eventForm.name}\"` : '')).trim();
        
        if (effectiveName) {
          // Подготавливаем relations для отправки на сервер
          const participantRelations = (localGroupState.participant_relations || []).map((rel: any) => ({
            participant_id: rel.participant_id || rel.participant?.id || 0,
            relation_type: rel.relation_type
          })).filter((rel: any) => rel.participant_id > 0);
          
          const groupRelations = (localGroupState.group_relations || []).map((rel: any) => ({
            target_group_id: rel.target_group_id || rel.target_group?.id || 0,
            relation_type: rel.relation_type
          })).filter((rel: any) => rel.target_group_id > 0);
          
          if (serverGroupState?.id && serverGroupState.id > 0) {
            // Обновляем существующую группу
            const payload: any = { 
              name: effectiveName,
              is_event_group: true,
              participant_relations: participantRelations,
              group_relations: groupRelations
            };
            try {
              const updatedResp = await groupsV2Api.update(serverGroupState.id, payload, eventumSlug || undefined);
              const updated = (updatedResp as any).data ?? updatedResp;
              ensuredEventGroupId = (updated as any).id;
              
              // Обновляем оба состояния после успешного сохранения
              // Перезагружаем для получения полных данных с relations
              try {
                const reloadResp = await groupsV2Api.getAll(eventumSlug || '', { includeEventGroups: true });
                const reloadGroups = (reloadResp as any).data ?? reloadResp;
                const reloaded = (reloadGroups as any[]).find((g: any) => g.id === ensuredEventGroupId) || updated;
                setServerGroupState(reloaded);
                setLocalGroupState(reloaded);
              } catch {
                // Если перезагрузка не удалась, используем ответ от обновления
                setServerGroupState(updated);
                setLocalGroupState(updated);
              }
            } catch (e) {
              console.error('Ошибка обновления группы V2:', e);
              throw e;
            }
          } else {
            // Создаем новую группу
            const createPayload: any = { 
              name: effectiveName, 
              is_event_group: true,
              participant_relations: participantRelations,
              group_relations: groupRelations
            };
            try {
              const createdResp = await groupsV2Api.create(createPayload, eventumSlug || undefined);
              const created = (createdResp as any).data ?? createdResp;
              ensuredEventGroupId = (created as any).id;
              
              // Обновляем оба состояния после успешного создания
              try {
                const reloadResp = await groupsV2Api.getAll(eventumSlug || '', { includeEventGroups: true });
                const reloadGroups = (reloadResp as any).data ?? reloadResp;
                const reloaded = (reloadGroups as any[]).find((g: any) => g.id === ensuredEventGroupId) || created;
                setServerGroupState(reloaded);
                setLocalGroupState(reloaded);
              } catch {
                setServerGroupState(created);
                setLocalGroupState(created);
              }
            } catch (e) {
              console.error('Ошибка создания группы V2:', e);
              throw e;
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
        max_participants: eventForm.max_participants,
        image_url: eventForm.image_url || undefined,
        participants: eventForm.participants,
        groups: eventForm.groups,
        location_ids: eventForm.location_ids,
        tag_ids: eventForm.tags,
        group_tag_ids: eventForm.group_tags,
        // Если выбрана/создана группа V2 — передаем её ID для привязки
        // Используем ensuredEventGroupId (получен после сохранения группы) или serverGroupState.id (если группа уже существовала и не изменялась)
        event_group_v2_id_write: ensuredEventGroupId || (serverGroupState?.id && serverGroupState.id > 0 ? serverGroupState.id : null)
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

  // Функция для получения группы по ID (сначала из localGroupState, потом из allGroupsV2)
  const getGroupV2ById = (id: number): ParticipantGroupV2 | null => {
    // Если это локальная группа - используем её напрямую
    if (localGroupState?.id === id) {
      return localGroupState;
    }
    // Иначе ищем в allGroupsV2
    return allGroupsV2.find(g => g.id === id) || null;
  };

  // Рекурсивная функция для подсчета участников из группы
  const collectParticipantsFromGroup = (groupId: number, visited: Set<number> = new Set()): Set<number> => {
    if (visited.has(groupId)) return new Set();
    visited.add(groupId);
    
    const group = getGroupV2ById(groupId);
    if (!group) return new Set();

    const inclusivePR = group.participant_relations?.filter(r => r.relation_type === 'inclusive') || [];
    const inclusiveGR = group.group_relations?.filter(r => r.relation_type === 'inclusive') || [];
    const exclusivePR = group.participant_relations?.filter(r => r.relation_type === 'exclusive') || [];
    const exclusiveGR = group.group_relations?.filter(r => r.relation_type === 'exclusive') || [];

    const result = new Set<number>();
    
    // Если нет включений - все участники, минус исключения
    if (inclusivePR.length === 0 && inclusiveGR.length === 0) {
      participants.forEach(p => result.add(p.id));
      exclusivePR.forEach(r => result.delete(r.participant_id || r.participant?.id || 0));
      exclusiveGR.forEach(r => {
        const sub = collectParticipantsFromGroup(r.target_group_id || r.target_group?.id || 0, visited);
        sub.forEach(pid => result.delete(pid));
      });
      return result;
    }

    // Иначе только включения, минус исключения
    inclusivePR.forEach(r => {
      const pid = r.participant_id || r.participant?.id || 0;
      if (pid > 0) result.add(pid);
    });
    inclusiveGR.forEach(r => {
      const sub = collectParticipantsFromGroup(r.target_group_id || r.target_group?.id || 0, visited);
      sub.forEach(pid => result.add(pid));
    });
    exclusivePR.forEach(r => {
      const pid = r.participant_id || r.participant?.id || 0;
      if (pid > 0) result.delete(pid);
    });
    exclusiveGR.forEach(r => {
      const sub = collectParticipantsFromGroup(r.target_group_id || r.target_group?.id || 0, visited);
      sub.forEach(pid => result.delete(pid));
    });
    
    return result;
  };

  // Подсчет участников: если есть локальная группа (даже с id: 0) - считаем по ней, иначе все участники
  const participantsCount = (() => {
    if (!localGroupState) {
      return participants.length;
    }
    
    // Если группа еще не создана (id: 0), считаем напрямую по localGroupState
    if (localGroupState.id === 0) {
      const inclusivePR = localGroupState.participant_relations?.filter(r => r.relation_type === 'inclusive') || [];
      const inclusiveGR = localGroupState.group_relations?.filter(r => r.relation_type === 'inclusive') || [];
      const exclusivePR = localGroupState.participant_relations?.filter(r => r.relation_type === 'exclusive') || [];
      const exclusiveGR = localGroupState.group_relations?.filter(r => r.relation_type === 'exclusive') || [];
      
      const result = new Set<number>();
      
      if (inclusivePR.length === 0 && inclusiveGR.length === 0) {
        participants.forEach(p => result.add(p.id));
        exclusivePR.forEach(r => result.delete(r.participant_id || 0));
        exclusiveGR.forEach(r => {
          const sub = collectParticipantsFromGroup(r.target_group_id || 0);
          sub.forEach(pid => result.delete(pid));
        });
        return result.size;
      }
      
      inclusivePR.forEach(r => {
        const pid = r.participant_id || 0;
        if (pid > 0) result.add(pid);
      });
      inclusiveGR.forEach(r => {
        const sub = collectParticipantsFromGroup(r.target_group_id || 0);
        sub.forEach(pid => result.add(pid));
      });
      exclusivePR.forEach(r => {
        const pid = r.participant_id || 0;
        if (pid > 0) result.delete(pid);
      });
      exclusiveGR.forEach(r => {
        const sub = collectParticipantsFromGroup(r.target_group_id || 0);
        sub.forEach(pid => result.delete(pid));
      });
      
      return result.size;
    }
    
    // Для существующей группы используем обычный подсчет
    return collectParticipantsFromGroup(localGroupState.id).size;
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
            onUpload={handleImageUpload}
            isUploading={isUploadingImage}
            />
          ) : (
            <ParticipantsTab 
              eventForm={eventForm}
              eventumSlug={eventumSlug}
              localGroupState={localGroupState}
              onLocalGroupStateChange={setLocalGroupState}
              availableGroupsV2={allGroupsV2}
              isLoadingGroupV2={isLoadingGroupV2}
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

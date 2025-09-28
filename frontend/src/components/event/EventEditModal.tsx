import { useState, useRef, useEffect } from "react";
import type { Event, EventTag, Location } from "../../types";
import { LocationSelector } from "../location/LocationSelector";

interface EventEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: {
    name: string;
    description: string;
    start_time: string;
    end_time: string;
    tags?: number[];
    tag_ids?: number[];
    location_id?: number;
  }) => Promise<void>;
  event?: Event | null;
  eventTags: EventTag[];
  locations: Location[];
  title?: string;
}

const EventEditModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  event, 
  eventTags, 
  locations,
  title 
}: EventEditModalProps) => {
  const [eventForm, setEventForm] = useState({
    name: "",
    description: "",
    start_time: "",
    end_time: "",
    tags: [] as number[],
    location_id: undefined as number | undefined
  });
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const tagInputRef = useRef<HTMLDivElement>(null);


  // Обработка кликов вне области ввода тегов
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
    if (isOpen) {
      if (event) {
        // Извлекаем ID из объектов тегов и локации
        const tagIds = event.tags.map(tag => tag.id);
        const locationId = event.location?.id || event.location_id;
        setEventForm({
          name: event.name,
          description: event.description,
          start_time: formatDateTimeForInput(event.start_time),
          end_time: formatDateTimeForInput(event.end_time),
          tags: tagIds,
          location_id: locationId
        });
      } else {
        setEventForm({
          name: "",
          description: "",
          start_time: getDefaultDateTime(),
          end_time: getDefaultEndDateTime(),
          tags: [],
          location_id: undefined
        });
      }
      setTagSearchQuery("");
      setShowTagSuggestions(false);
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

  const getEndTimeFromStartTime = (startTime: string) => {
    if (!startTime) return "";
    const startDate = new Date(startTime);
    // Добавляем час к времени начала
    startDate.setHours(startDate.getHours() + 1);
    return formatLocalDateTime(startDate);
  };

  const addTagToForm = (tag: EventTag) => {
    if (!eventForm.tags.includes(tag.id)) {
      setEventForm(prev => ({
        ...prev,
        tags: [...prev.tags, tag.id]
      }));
    }
    setTagSearchQuery("");
    setShowTagSuggestions(false);
  };

  const removeTagFromForm = (tagId: number) => {
    setEventForm(prev => ({
      ...prev,
      tags: prev.tags.filter(id => id !== tagId)
    }));
  };

  const getTagSuggestions = () => {
    const filteredTags = eventTags.filter(tag => 
      !eventForm.tags.includes(tag.id) &&
      (!tagSearchQuery.trim() || tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase()))
    );
    
    return filteredTags.slice(0, 5);
  };

  const handleSave = async () => {
    if (!eventForm.name.trim() || !eventForm.start_time || !eventForm.end_time) return;
    
    setIsSaving(true);
    try {
      // Преобразуем tags в tag_ids для backend
      const eventData = {
        name: eventForm.name,
        description: eventForm.description,
        start_time: eventForm.start_time,
        end_time: eventForm.end_time,
        location_id: eventForm.location_id,
        tag_ids: eventForm.tags
      };
      await onSave(eventData);
      onClose();
    } catch (error) {
      console.error('Ошибка сохранения мероприятия:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = eventForm.name.trim() && eventForm.start_time && eventForm.end_time;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
      <div className="w-full max-w-md mx-4 bg-white rounded-xl shadow-lg pointer-events-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {title || (event ? 'Редактировать мероприятие' : 'Добавить мероприятие')}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название *
              </label>
              <input
                type="text"
                value={eventForm.name}
                onChange={(e) => setEventForm(prev => ({ ...prev, name: e.target.value }))}
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
                onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                rows={3}
                placeholder="Введите описание мероприятия"
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
                    setEventForm(prev => ({ 
                      ...prev, 
                      start_time: newStartTime,
                      end_time: getEndTimeFromStartTime(newStartTime)
                    }));
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
                  onChange={(e) => setEventForm(prev => ({ ...prev, end_time: e.target.value }))}
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
                onLocationChange={(locationId) => setEventForm(prev => ({
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
                  onFocus={() => setShowTagSuggestions(true)}
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
                    {eventForm.tags.map(tagId => {
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

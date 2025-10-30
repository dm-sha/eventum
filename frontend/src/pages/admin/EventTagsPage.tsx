import { useEffect, useState } from 'react';
import {
  getEventsForEventum,
  updateEvent,
} from '../../api';
import { eventTagsApi } from '../../api/eventumApi';
import type { EventTag, Event } from '../../types';
import { IconPencil, IconX, IconPlus, IconInformationCircle, IconTrash } from '../../components/icons';
import { useEventumSlug } from '../../hooks/useEventumSlug';
import TagsLoadingSkeleton from '../../components/admin/skeletons/TagsLoadingSkeleton';

const AdminEventTagsPage = () => {
  const eventumSlug = useEventumSlug();
  const [tags, setTags] = useState<EventTag[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filter, setFilter] = useState('');
  const [editingTag, setEditingTag] = useState<number | null>(null);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [expandedTags, setExpandedTags] = useState<Set<number>>(new Set());
  const [editingEvents, setEditingEvents] = useState<Event[]>([]);

  const [tagName, setTagName] = useState('');
  const [eventQuery, setEventQuery] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Event[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);

  useEffect(() => {
    if (!eventumSlug) return;
    
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [tagsData, eventsData] = await Promise.all([
          eventTagsApi.getAll(eventumSlug).then(res => res.data),
          getEventsForEventum(eventumSlug)
        ]);
        setTags(tagsData);
        setEvents(eventsData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [eventumSlug]);

  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase())
  );

  const suggestions = (() => {
    const normalizedQuery = eventQuery.toLowerCase();
    const excludeIdSet = new Set(
      (editingTag || isCreatingTag ? editingEvents : selectedEvents).map((e) => e.id)
    );
    const baseList = events.filter((e) => !excludeIdSet.has(e.id));
    const filtered = normalizedQuery
      ? baseList.filter((e) => e.name.toLowerCase().includes(normalizedQuery))
      : baseList;
    return filtered.slice(0, 5);
  })();

  const addEvent = (e: Event) => {
    if (editingTag || isCreatingTag) {
      // Если мы в режиме редактирования или создания, добавляем мероприятие во временный список
      setEditingEvents(prev => {
        if (prev.some(ee => ee.id === e.id)) return prev;
        return [...prev, e];
      });
    } else {
      // Если создаем новый тег, добавляем в selectedEvents
      setSelectedEvents([...selectedEvents, e]);
    }
    setEventQuery('');
    setIsSuggestionsOpen(false);
  };

  const removeEditingEvent = (id: number) => {
    setEditingEvents(editingEvents.filter((e) => e.id !== id));
  };

  const handleSave = async () => {
    if (!eventumSlug || !tagName.trim()) return;
    
    setIsSaving(true);
    try {
      const data = {
        name: tagName,
      };
      const created = (await eventTagsApi.create(data, eventumSlug)).data;
      setTags([...tags, created]);
      
      // Обновляем мероприятия, добавляя к ним новый тег
      if (editingEvents.length > 0) {
        for (const event of editingEvents) {
          const currentTagIds = event.tags.map(t => t.id);
          const updatedTagIds = [...currentTagIds, created.id];
          
          await updateEvent(eventumSlug, event.id, {
            name: event.name,
            description: event.description,
            start_time: event.start_time,
            end_time: event.end_time,
            tag_ids: updatedTagIds,
            location_ids: event.location_ids,
          });
        }
        
        // Обновляем локальное состояние мероприятий
        setEvents(events.map(event => {
          if (editingEvents.some(e => e.id === event.id)) {
            return {
              ...event,
              tags: [...event.tags, created]
            };
          }
          return event;
        }));
      }
      
      setIsCreatingTag(false);
      setTagName('');
      setEditingEvents([]);
    } catch (error) {
      console.error('Ошибка создания тега:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTag = () => {
    setIsCreatingTag(true);
    setTagName('');
    setEditingEvents([]);
    setExpandedTags(prev => new Set([...prev, -1])); // -1 для карточки создания
  };

  const handleEditTag = (tag: EventTag) => {
    setEditingTag(tag.id);
    setTagName(tag.name);
    // Находим мероприятия с этим тегом
    const tagEvents = events.filter(e => e.tags.some(t => t.id === tag.id));
    setEditingEvents(tagEvents);
    setExpandedTags(prev => new Set([...prev, tag.id]));
  };

  const handleUpdateTag = async (tagId: number) => {
    if (!eventumSlug || !tagName.trim()) return;
    
    setIsUpdating(true);
    setValidationError(null);
    try {
      const data = {
        name: tagName,
      };
      const updated = (await eventTagsApi.update(tagId, data, eventumSlug)).data;
      setTags(tags.map(t => t.id === tagId ? updated : t));
      
      // Обновляем связи тега с мероприятиями
      const originalTagEvents = events.filter(e => e.tags.some(t => t.id === tagId));
      
      // Удаляем тег из мероприятий, которые больше не должны его иметь
      for (const event of originalTagEvents) {
        if (!editingEvents.some(e => e.id === event.id)) {
          const currentTagIds = event.tags.map(t => t.id);
          const updatedTagIds = currentTagIds.filter(id => id !== tagId);
          
          await updateEvent(eventumSlug, event.id, {
            name: event.name,
            description: event.description,
            start_time: event.start_time,
            end_time: event.end_time,
            tag_ids: updatedTagIds,
            location_ids: event.location_ids,
          });
        }
      }
      
      // Добавляем тег к новым мероприятиям
      for (const event of editingEvents) {
        if (!originalTagEvents.some(e => e.id === event.id)) {
          const currentTagIds = event.tags.map(t => t.id);
          const updatedTagIds = [...currentTagIds, tagId];
          
          try {
            await updateEvent(eventumSlug, event.id, {
              name: event.name,
              description: event.description,
              start_time: event.start_time,
              end_time: event.end_time,
              tag_ids: updatedTagIds,
              location_ids: event.location_ids,
            });
          } catch (error: any) {
            // Обрабатываем ошибки валидации при добавлении тега к мероприятию
            if (error.response?.status === 400 && error.response?.data) {
              let errorMessage = '';
              
              // Проверяем ошибки валидации тегов
              if (error.response.data.tag_ids) {
                errorMessage = Array.isArray(error.response.data.tag_ids) 
                  ? error.response.data.tag_ids.join(' ')
                  : error.response.data.tag_ids;
              } else if (error.response.data.non_field_errors) {
                errorMessage = Array.isArray(error.response.data.non_field_errors)
                  ? error.response.data.non_field_errors.join(' ')
                  : error.response.data.non_field_errors;
              } else {
                errorMessage = `Не удалось добавить мероприятие "${event.name}" к тегу`;
              }
              
              setValidationError(errorMessage);
              throw error; // Прерываем выполнение, чтобы не обновлять состояние
            } else if (error.response?.status === 500) {
              // Обрабатываем серверные ошибки (возможно, ошибки валидации на уровне модели)
              let errorMessage = '';
              
              if (error.response.data && typeof error.response.data === 'object') {
                // Пытаемся извлечь сообщение об ошибке из ответа
                if (error.response.data.detail) {
                  errorMessage = error.response.data.detail;
                } else if (error.response.data.message) {
                  errorMessage = error.response.data.message;
                } else if (error.response.data.error) {
                  errorMessage = error.response.data.error;
                } else {
                  // Если это ошибка валидации, которая пришла как 500, но содержит информацию о тегах
                  const responseText = JSON.stringify(error.response.data);
                  if (responseText.includes('волн') || responseText.includes('registration') || responseText.includes('По записи')) {
                    errorMessage = `Нельзя добавить мероприятие "${event.name}" к тегу, так как оно связано с волной регистрации. Мероприятия в волнах должны иметь тип участников 'По записи'.`;
                  } else {
                    errorMessage = `Ошибка сервера при добавлении мероприятия "${event.name}" к тегу`;
                  }
                }
              } else {
                errorMessage = `Ошибка сервера при добавлении мероприятия "${event.name}" к тегу`;
              }
              
              setValidationError(errorMessage);
              throw error; // Прерываем выполнение, чтобы не обновлять состояние
            }
            throw error;
          }
        }
      }
      
      // Обновляем локальное состояние мероприятий
      setEvents(events.map(event => {
        const shouldHaveTag = editingEvents.some(e => e.id === event.id);
        const currentlyHasTag = event.tags.some(t => t.id === tagId);
        
        if (shouldHaveTag && !currentlyHasTag) {
          // Добавляем тег
          return {
            ...event,
            tags: [...event.tags, updated]
          };
        } else if (!shouldHaveTag && currentlyHasTag) {
          // Удаляем тег
          return {
            ...event,
            tags: event.tags.filter(t => t.id !== tagId)
          };
        }
        return event;
      }));
      
      setEditingTag(null);
      setTagName('');
      setEditingEvents([]);
    } catch (error: any) {
      console.error('Ошибка обновления тега:', error);
      
      // Если ошибка не была обработана выше, показываем общую ошибку
      if (!validationError) {
        setValidationError('Произошла ошибка при обновлении тега. Попробуйте еще раз.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditingTag(null);
    setIsCreatingTag(false);
    setTagName('');
    setEditingEvents([]);
    setEventQuery('');
    setIsSuggestionsOpen(false);
    setValidationError(null);
  };

  const handleDeleteTag = async (tagId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот тег?')) return;
    if (!eventumSlug) return;
    
    try {
      await eventTagsApi.delete(tagId, eventumSlug);
      setTags(tags.filter(t => t.id !== tagId));
      setEditingTag(null);
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };

  const toggleTagExpansion = (tagId: number) => {
    setExpandedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  if (!eventumSlug) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Не найден slug мероприятия</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
        <h2 className="text-2xl font-semibold text-gray-900">Теги мероприятий</h2>
          <div className="group relative">
            <IconInformationCircle size={20} className="text-gray-400 cursor-help" />
            <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-normal w-80 z-50">
          Управляйте тегами для категоризации мероприятий. Теги помогают организовать и фильтровать события.
            </div>
          </div>
        </div>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="text-xs text-gray-500">Всего тегов: {filteredTags.length}</span>
      </div>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Поиск тега"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />

      {isLoading ? (
        <TagsLoadingSkeleton />
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {/* Карточка для добавления нового тега */}
          {!isCreatingTag ? (
            <div 
              onClick={handleCreateTag}
              className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50 min-h-[160px] break-inside-avoid mb-4"
            >
              <div className="flex flex-col items-center gap-2">
                <IconPlus size={32} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Добавить тег</span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm break-inside-avoid mb-4">
              <div className="flex items-start justify-between mb-3">
                <input
                  type="text"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Название тега"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <div className="mb-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={eventQuery}
                      onChange={(e) => setEventQuery(e.target.value)}
                      onFocus={() => setIsSuggestionsOpen(true)}
                      onBlur={() => setIsSuggestionsOpen(false)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Добавить мероприятие..."
                    />
                    {isSuggestionsOpen && suggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                        {suggestions.map((e) => (
                          <button
                            key={e.id}
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => addEvent(e)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            {e.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-0">
                  {editingEvents.map((event, index) => (
                    <div key={event.id}>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-700">{event.name}</span>
                        <button
                          onClick={() => removeEditingEvent(event.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                        >
                          <IconX size={14} />
                        </button>
                      </div>
                      {index < editingEvents.length - 1 && (
                        <div className="border-b border-gray-100 my-1"></div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={!tagName.trim() || isSaving}
                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Создание...' : 'Создать'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredTags.map((tag) => {
            const isEditing = editingTag === tag.id;
            const tagEvents = isEditing 
              ? editingEvents 
              : events.filter(e => e.tags.some(t => t.id === tag.id));
            
            const isExpanded = expandedTags.has(tag.id);
            const showAllButton = tagEvents.length > 3;
            const displayEvents = isExpanded ? tagEvents : tagEvents.slice(0, 3);

            return (
              <div key={tag.id} className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm break-inside-avoid mb-4">
                <div className="flex items-start justify-between mb-3">
                  {isEditing ? (
                    <input
                      type="text"
                      value={tagName}
                      onChange={(e) => setTagName(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  ) : (
                    <h3 className="text-lg font-semibold text-gray-900">{tag.name}</h3>
                  )}
                  {isEditing ? (
                    <button
                      onClick={() => handleDeleteTag(tag.id)}
                      className="rounded-lg p-1 text-red-400 hover:bg-red-100 hover:text-red-600"
                    >
                      <IconTrash size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEditTag(tag)}
                      className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <IconPencil size={16} />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {isEditing && (
                    <div className="mb-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={eventQuery}
                          onChange={(e) => setEventQuery(e.target.value)}
                          onFocus={() => setIsSuggestionsOpen(true)}
                          onBlur={() => setIsSuggestionsOpen(false)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Добавить мероприятие..."
                        />
                        {isSuggestionsOpen && suggestions.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                            {suggestions.map((e) => (
                              <button
                                key={e.id}
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => addEvent(e)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                              >
                                {e.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-0">
                    {displayEvents.map((event, index) => (
                      <div key={event.id}>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-gray-700">{event.name}</span>
                          {isEditing && (
                            <button
                              onClick={() => removeEditingEvent(event.id)}
                              className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                            >
                              <IconX size={14} />
                            </button>
                          )}
                        </div>
                        {index < displayEvents.length - 1 && (
                          <div className="border-b border-gray-100 my-1"></div>
                        )}
                      </div>
                    ))}
                  </div>

                  {showAllButton && (
                    <button
                      onClick={() => toggleTagExpansion(tag.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {isExpanded ? 'Скрыть' : `Показать все (${tagEvents.length})`}
                    </button>
                  )}

                  {isEditing && (
                    <>
                      {/* Отображение ошибки валидации */}
                      {validationError && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                          <div className="text-xs text-red-600">
                            {validationError}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleUpdateTag(tag.id)}
                          disabled={!tagName.trim() || isUpdating}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          {isUpdating ? 'Сохранение...' : 'Сохранить'}
                        </button>
                        <button
                          onClick={handleCancel}
                          disabled={isUpdating}
                          className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Отмена
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && filteredTags.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
          Теги не найдены
        </div>
      )}
    </div>
  );
};

export default AdminEventTagsPage;

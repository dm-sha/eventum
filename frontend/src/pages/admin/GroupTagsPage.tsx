import { useEffect, useState } from 'react';
import {
  getGroupsForEventum,
  updateGroup,
} from '../../api';
import { groupTagApi } from '../../api/groupTag';
import type { GroupTag, ParticipantGroup } from '../../types';
import { IconPencil, IconX, IconPlus, IconInformationCircle, IconTrash } from '../../components/icons';
import { useEventumSlug } from '../../hooks/useEventumSlug';

const AdminGroupTagsPage = () => {
  const eventumSlug = useEventumSlug();
  const [tags, setTags] = useState<GroupTag[]>([]);
  const [groups, setGroups] = useState<ParticipantGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filter, setFilter] = useState('');
  const [editingTag, setEditingTag] = useState<number | null>(null);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [expandedTags, setExpandedTags] = useState<Set<number>>(new Set());
  const [editingGroups, setEditingGroups] = useState<ParticipantGroup[]>([]);

  const [tagName, setTagName] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<ParticipantGroup[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!eventumSlug) return;
    
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [tagsData, groupsData] = await Promise.all([
          groupTagApi.getGroupTags(eventumSlug),
          getGroupsForEventum(eventumSlug)
        ]);
        setTags(tagsData);
        setGroups(groupsData);
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

  const suggestions = groupQuery
    ? groups
        .filter((g) => {
          const matchesQuery = g.name.toLowerCase().includes(groupQuery.toLowerCase());
          
          if (editingTag || isCreatingTag) {
            // В режиме редактирования или создания исключаем группы, которые уже в списке редактирования
            return matchesQuery && !editingGroups.some((eg) => eg.id === g.id);
          } else {
            // При создании нового тега исключаем уже выбранные группы
            return matchesQuery && !selectedGroups.some((sg) => sg.id === g.id);
          }
        })
        .slice(0, 5)
    : [];

  const addGroup = (g: ParticipantGroup) => {
    if (editingTag || isCreatingTag) {
      // Если мы в режиме редактирования или создания, добавляем группу во временный список
      setEditingGroups(prev => {
        if (prev.some(eg => eg.id === g.id)) return prev;
        return [...prev, g];
      });
    } else {
      // Если создаем новый тег, добавляем в selectedGroups
      setSelectedGroups([...selectedGroups, g]);
    }
    setGroupQuery('');
  };

  const removeEditingGroup = (id: number) => {
    setEditingGroups(editingGroups.filter((g) => g.id !== id));
  };

  const handleSave = async () => {
    if (!eventumSlug || !tagName.trim()) return;
    
    setIsSaving(true);
    try {
      const data = {
        name: tagName,
      };
      const created = await groupTagApi.createGroupTag(eventumSlug, data);
      setTags([...tags, created]);
      
      // Обновляем группы, добавляя к ним новый тег
      if (editingGroups.length > 0) {
        for (const group of editingGroups) {
          const currentTagIds = group.tags?.map(t => t.id) || [];
          const updatedTagIds = [...currentTagIds, created.id];
          
          await updateGroup(eventumSlug, group.id, {
            name: group.name,
            participants: group.participants,
            tag_ids: updatedTagIds,
          });
        }
        
        // Обновляем локальное состояние групп
        setGroups(groups.map(group => {
          if (editingGroups.some(g => g.id === group.id)) {
            return {
              ...group,
              tags: [...(group.tags || []), created]
            };
          }
          return group;
        }));
      }
      
      setIsCreatingTag(false);
      setTagName('');
      setEditingGroups([]);
    } catch (error) {
      console.error('Ошибка создания тега:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTag = () => {
    setIsCreatingTag(true);
    setTagName('');
    setEditingGroups([]);
    setExpandedTags(prev => new Set([...prev, -1])); // -1 для карточки создания
  };

  const handleEditTag = (tag: GroupTag) => {
    setEditingTag(tag.id);
    setTagName(tag.name);
    // Находим группы с этим тегом
    const tagGroups = groups.filter(g => g.tags?.some(t => t.id === tag.id));
    setEditingGroups(tagGroups);
    setExpandedTags(prev => new Set([...prev, tag.id]));
  };

  const handleUpdateTag = async (tagId: number) => {
    if (!eventumSlug || !tagName.trim()) return;
    
    setIsUpdating(true);
    try {
      const data = {
        name: tagName,
      };
      const updated = await groupTagApi.updateGroupTag(eventumSlug, tagId, data);
      setTags(tags.map(t => t.id === tagId ? updated : t));
      
      // Обновляем связи тега с группами
      const originalTagGroups = groups.filter(g => g.tags?.some(t => t.id === tagId));
      
      // Удаляем тег из групп, которые больше не должны его иметь
      for (const group of originalTagGroups) {
        if (!editingGroups.some(g => g.id === group.id)) {
          const currentTagIds = group.tags?.map(t => t.id) || [];
          const updatedTagIds = currentTagIds.filter(id => id !== tagId);
          
          await updateGroup(eventumSlug, group.id, {
            name: group.name,
            participants: group.participants,
            tag_ids: updatedTagIds,
          });
        }
      }
      
      // Добавляем тег к новым группам
      for (const group of editingGroups) {
        if (!originalTagGroups.some(g => g.id === group.id)) {
          const currentTagIds = group.tags?.map(t => t.id) || [];
          const updatedTagIds = [...currentTagIds, tagId];
          
          await updateGroup(eventumSlug, group.id, {
            name: group.name,
            participants: group.participants,
            tag_ids: updatedTagIds,
          });
        }
      }
      
      // Обновляем локальное состояние групп
      setGroups(groups.map(group => {
        const shouldHaveTag = editingGroups.some(g => g.id === group.id);
        const currentlyHasTag = group.tags?.some(t => t.id === tagId);
        
        if (shouldHaveTag && !currentlyHasTag) {
          // Добавляем тег
          return {
            ...group,
            tags: [...(group.tags || []), updated]
          };
        } else if (!shouldHaveTag && currentlyHasTag) {
          // Удаляем тег
          return {
            ...group,
            tags: group.tags?.filter(t => t.id !== tagId) || []
          };
        }
        return group;
      }));
      
      setEditingTag(null);
      setTagName('');
      setEditingGroups([]);
    } catch (error) {
      console.error('Ошибка обновления тега:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditingTag(null);
    setIsCreatingTag(false);
    setTagName('');
    setEditingGroups([]);
    setGroupQuery('');
  };

  const handleDeleteTag = async (tagId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот тег?')) return;
    if (!eventumSlug) return;
    
    try {
      await groupTagApi.deleteGroupTag(eventumSlug, tagId);
      setTags(tags.filter(t => t.id !== tagId));
      setEditingTag(null);
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

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
        <h2 className="text-2xl font-semibold text-gray-900">Теги групп</h2>
          <div className="group relative">
            <IconInformationCircle size={20} className="text-gray-400 cursor-help" />
            <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-normal w-80 z-50">
          Управляйте тегами для категоризации групп участников. Теги помогают организовать и фильтровать группы.
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
        <LoadingSpinner />
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
                      value={groupQuery}
                      onChange={(e) => setGroupQuery(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Добавить группу..."
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                        {suggestions.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => addGroup(g)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            {g.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-0">
                  {editingGroups.map((group, index) => (
                    <div key={group.id}>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-sm text-gray-700">{group.name}</span>
                        <button
                          onClick={() => removeEditingGroup(group.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                        >
                          <IconX size={14} />
                        </button>
                      </div>
                      {index < editingGroups.length - 1 && (
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
            const tagGroups = isEditing 
              ? editingGroups 
              : groups.filter(g => g.tags?.some(t => t.id === tag.id));
            
            const isExpanded = expandedTags.has(tag.id);
            const showAllButton = tagGroups.length > 3;
            const displayGroups = isExpanded ? tagGroups : tagGroups.slice(0, 3);

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
                          value={groupQuery}
                          onChange={(e) => setGroupQuery(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Добавить группу..."
                        />
                        {suggestions.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                            {suggestions.map((g) => (
                              <button
                                key={g.id}
                                onClick={() => addGroup(g)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                              >
                                {g.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-0">
                    {displayGroups.map((group, index) => (
                      <div key={group.id}>
                        <div className="flex items-center justify-between py-1">
                          <span className="text-sm text-gray-700">{group.name}</span>
                          {isEditing && (
                            <button
                              onClick={() => removeEditingGroup(group.id)}
                              className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                            >
                              <IconX size={14} />
                            </button>
                          )}
                        </div>
                        {index < displayGroups.length - 1 && (
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
                      {isExpanded ? 'Скрыть' : `Показать все (${tagGroups.length})`}
                    </button>
                  )}

                  {isEditing && (
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

export default AdminGroupTagsPage;

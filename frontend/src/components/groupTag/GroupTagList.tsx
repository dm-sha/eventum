import React, { useState, useEffect } from 'react';
import type { GroupTag, ParticipantGroup } from '../../types';
import { groupTagApi } from '../../api/groupTag';
import LoadingSpinner from '../LoadingSpinner';

interface GroupTagListProps {
  eventumSlug: string;
}

const GroupTagList: React.FC<GroupTagListProps> = ({ eventumSlug }) => {
  const [tags, setTags] = useState<GroupTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTag, setEditingTag] = useState<GroupTag | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [groupsForTags, setGroupsForTags] = useState<Map<number, ParticipantGroup[]>>(new Map());
  const [loadingGroups, setLoadingGroups] = useState<Set<number>>(new Set());
  const [allGroups, setAllGroups] = useState<ParticipantGroup[]>([]);
  const [showAddGroupModal, setShowAddGroupModal] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const GROUPS_PREVIEW_LIMIT = 3;

  useEffect(() => {
    loadTags();
    loadAllGroups();
  }, [eventumSlug]);

  // Загружаем группы для всех тегов после загрузки тегов
  useEffect(() => {
    if (tags.length > 0) {
      tags.forEach(tag => {
        loadGroupsForTag(tag.id);
      });
    }
  }, [tags]);

  const loadTags = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await groupTagApi.getGroupTags(eventumSlug);
      setTags(data);
    } catch (err) {
      setError('Ошибка при загрузке тегов групп');
      console.error('Error loading group tags:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllGroups = async () => {
    try {
      const data = await groupTagApi.getAllGroups(eventumSlug);
      setAllGroups(data);
    } catch (err) {
      console.error('Error loading all groups:', err);
    }
  };

  const loadGroupsForTag = async (tagId: number) => {
    if (groupsForTags.has(tagId)) return;

    try {
      setLoadingGroups(prev => new Set(prev).add(tagId));
      const groups = await groupTagApi.getGroupsForTag(eventumSlug, tagId);
      setGroupsForTags(prev => new Map(prev).set(tagId, groups));
    } catch (err) {
      console.error('Error loading groups for tag:', err);
      setError(`Ошибка при загрузке групп для тега: ${err}`);
    } finally {
      setLoadingGroups(prev => {
        const newSet = new Set(prev);
        newSet.delete(tagId);
        return newSet;
      });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsCreating(true);
    try {
      const newTag = await groupTagApi.createGroupTag(eventumSlug, { name: formData.name });
      setTags([...tags, newTag]);
      setFormData({ name: '' });
      setShowCreateForm(false);
    } catch (err) {
      setError('Ошибка при создании тега');
      console.error('Error creating group tag:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !editingTag) return;

    setIsUpdating(true);
    try {
      const updatedTag = await groupTagApi.updateGroupTag(
        eventumSlug, 
        editingTag.id, 
        { name: formData.name }
      );
      setTags(tags.map(tag => tag.id === editingTag.id ? updatedTag : tag));
      setFormData({ name: '' });
      setEditingTag(null);
    } catch (err) {
      setError('Ошибка при обновлении тега');
      console.error('Error updating group tag:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (tagId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот тег?')) return;

    try {
      await groupTagApi.deleteGroupTag(eventumSlug, tagId);
      setTags(tags.filter(tag => tag.id !== tagId));
      setGroupsForTags(prev => {
        const newMap = new Map(prev);
        newMap.delete(tagId);
        return newMap;
      });
      setExpandedGroups(prev => {
        const newSet = new Set(prev);
        newSet.delete(tagId);
        return newSet;
      });
    } catch (err) {
      setError('Ошибка при удалении тега');
      console.error('Error deleting group tag:', err);
    }
  };

  const startEdit = (tag: GroupTag) => {
    setEditingTag(tag);
    setFormData({ name: tag.name });
    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setFormData({ name: '' });
  };

  const cancelCreate = () => {
    setShowCreateForm(false);
    setFormData({ name: '' });
  };

  const handleRemoveGroupFromTag = async (tagId: number, groupId: number) => {
    if (!confirm('Вы уверены, что хотите отвязать эту группу от тега?')) return;

    try {
      await groupTagApi.removeGroupFromTag(eventumSlug, tagId, groupId);
      // Обновляем локальное состояние
      setGroupsForTags(prev => {
        const newMap = new Map(prev);
        const currentGroups = newMap.get(tagId) || [];
        const updatedGroups = currentGroups.filter(group => group.id !== groupId);
        newMap.set(tagId, updatedGroups);
        return newMap;
      });
    } catch (err) {
      setError('Ошибка при отвязке группы от тега');
      console.error('Error removing group from tag:', err);
    }
  };

  const handleAddGroupToTag = async (tagId: number, groupId: number) => {
    try {
      await groupTagApi.addGroupToTag(eventumSlug, tagId, groupId);
      // Обновляем локальное состояние
      const groupToAdd = allGroups.find(group => group.id === groupId);
      if (groupToAdd) {
        setGroupsForTags(prev => {
          const newMap = new Map(prev);
          const currentGroups = newMap.get(tagId) || [];
          if (!currentGroups.find(group => group.id === groupId)) {
            newMap.set(tagId, [...currentGroups, groupToAdd]);
          }
          return newMap;
        });
      }
      setShowAddGroupModal(null);
    } catch (err) {
      setError('Ошибка при привязке группы к тегу');
      console.error('Error adding group to tag:', err);
    }
  };

  const getAvailableGroupsForTag = (tagId: number): ParticipantGroup[] => {
    const currentGroups = getGroupsForTag(tagId);
    const currentGroupIds = currentGroups.map(group => group.id);
    return allGroups.filter(group => !currentGroupIds.includes(group.id));
  };

  const toggleGroupsExpansion = async (tagId: number) => {
    if (!groupsForTags.has(tagId)) {
      await loadGroupsForTag(tagId);
    }
    
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  const getGroupsForTag = (tagId: number): ParticipantGroup[] => {
    return groupsForTags.get(tagId) || [];
  };

  const isGroupsExpanded = (tagId: number): boolean => {
    return expandedGroups.has(tagId);
  };

  const isGroupsLoading = (tagId: number): boolean => {
    return loadingGroups.has(tagId);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Теги групп</h3>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Добавить тег
        </button>
      </div>

      {/* Форма создания */}
      {showCreateForm && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <h4 className="text-base font-semibold text-gray-900">Создать новый тег</h4>
          <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ name: e.target.value })}
              placeholder="Название тега"
              className="w-full flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              required
            />
            <button
              type="submit"
              disabled={isCreating}
              className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Создание...' : 'Создать'}
            </button>
            <button
              type="button"
              onClick={cancelCreate}
              className="inline-flex items-center justify-center rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              Отмена
            </button>
          </form>
        </div>
      )}

      {/* Список тегов */}
      <div className="space-y-4">
        {tags.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Теги групп не найдены. Создайте первый тег.
          </p>
        ) : (
          tags.map((tag) => {
            const groups = getGroupsForTag(tag.id);
            const isExpanded = isGroupsExpanded(tag.id);
            const isLoadingGroups = isGroupsLoading(tag.id);
            const hasMoreGroups = groups.length > GROUPS_PREVIEW_LIMIT;
            const displayGroups = isExpanded ? groups : groups.slice(0, GROUPS_PREVIEW_LIMIT);

            return (
              <div key={tag.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                {editingTag?.id === tag.id ? (
                  /* Форма редактирования */
                  <form onSubmit={handleUpdate} className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ name: e.target.value })}
                      className="w-full flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdating ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="inline-flex items-center justify-center rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                    >
                      Отмена
                    </button>
                  </form>
                ) : (
                  /* Отображение тега */
                <div className="space-y-3">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <h4 className="text-base font-semibold text-gray-900">{tag.name}</h4>
                        <p className="text-sm text-gray-500">slug: {tag.slug}</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          onClick={() => startEdit(tag)}
                          className="inline-flex items-center justify-center rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={() => handleDelete(tag.id)}
                          className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>

                    {/* Группы под тегом */}
                    <div className="border-t pt-3">
                      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h5 className="text-sm font-medium text-gray-700">
                          Группы ({groups.length})
                        </h5>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            onClick={() => setShowAddGroupModal(tag.id)}
                            className="inline-flex items-center justify-center rounded-lg border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 transition-colors hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                            title="Добавить группу к тегу"
                          >
                            + Добавить
                          </button>
                          {groups.length > 0 && (
                            <button
                              onClick={() => toggleGroupsExpansion(tag.id)}
                              disabled={isLoadingGroups}
                              className="inline-flex items-center justify-center rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isLoadingGroups ? 'Загрузка...' : isExpanded ? 'Свернуть' : 'Показать все'}
                            </button>
                          )}
                        </div>
                      </div>

                      {isLoadingGroups ? (
                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                          Загрузка групп...
                        </div>
                      ) : groups.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                          Нет групп с этим тегом
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {displayGroups.map((group) => (
                            <div
                              key={group.id}
                              className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span className="font-medium text-gray-800">{group.name}</span>
                              <button
                                onClick={() => handleRemoveGroupFromTag(tag.id, group.id)}
                                className="inline-flex items-center justify-center rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                                title="Отвязать группу от тега"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          {hasMoreGroups && !isExpanded && (
                            <div className="text-sm italic text-gray-500">
                              и еще {groups.length - GROUPS_PREVIEW_LIMIT} групп...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Модальное окно для добавления группы к тегу */}
      {showAddGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Добавить группу к тегу</h3>
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {getAvailableGroupsForTag(showAddGroupModal).length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                  Все группы уже привязаны к этому тегу
                </p>
              ) : (
                getAvailableGroupsForTag(showAddGroupModal).map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleAddGroupToTag(showAddGroupModal, group.id)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {group.name}
                  </button>
                ))
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowAddGroupModal(null)}
                className="inline-flex items-center justify-center rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupTagList;

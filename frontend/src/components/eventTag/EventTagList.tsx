import React, { useState, useEffect } from 'react';
import type { EventTag } from '../../types';
import { eventTagApi } from '../../api/eventTag';
import LoadingSpinner from '../LoadingSpinner';

interface EventTagListProps {
  eventumSlug: string;
}

const EventTagList: React.FC<EventTagListProps> = ({ eventumSlug }) => {
  const [tags, setTags] = useState<EventTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTag, setEditingTag] = useState<EventTag | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadTags();
  }, [eventumSlug]);

  const loadTags = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await eventTagApi.getEventTags(eventumSlug);
      setTags(data);
    } catch (err) {
      setError('Ошибка при загрузке тегов мероприятий');
      console.error('Error loading event tags:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsCreating(true);
    try {
      const newTag = await eventTagApi.createEventTag(eventumSlug, { name: formData.name });
      setTags([...tags, newTag]);
      setFormData({ name: '' });
      setShowCreateForm(false);
    } catch (err) {
      setError('Ошибка при создании тега');
      console.error('Error creating event tag:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !editingTag) return;

    setIsUpdating(true);
    try {
      const updatedTag = await eventTagApi.updateEventTag(
        eventumSlug, 
        editingTag.id, 
        { name: formData.name }
      );
      setTags(tags.map(tag => tag.id === editingTag.id ? updatedTag : tag));
      setFormData({ name: '' });
      setEditingTag(null);
    } catch (err) {
      setError('Ошибка при обновлении тега');
      console.error('Error updating event tag:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (tagId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот тег?')) return;

    try {
      await eventTagApi.deleteEventTag(eventumSlug, tagId);
      setTags(tags.filter(tag => tag.id !== tagId));
    } catch (err) {
      setError('Ошибка при удалении тега');
      console.error('Error deleting event tag:', err);
    }
  };

  const startEdit = (tag: EventTag) => {
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
        <h3 className="text-lg font-semibold text-gray-900">Теги мероприятий</h3>
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
      <div className="space-y-2">
        {tags.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Теги мероприятий не найдены. Создайте первый тег.
          </p>
        ) : (
          tags.map((tag) => (
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
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default EventTagList;

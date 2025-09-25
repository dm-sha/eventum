import React, { useState, useEffect } from 'react';
import type { EventTag } from '../../types';
import { eventTagApi } from '../../api/eventTag';
import type { CreateEventTagRequest, UpdateEventTagRequest } from '../../api/eventTag';
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

    try {
      const newTag = await eventTagApi.createEventTag(eventumSlug, { name: formData.name });
      setTags([...tags, newTag]);
      setFormData({ name: '' });
      setShowCreateForm(false);
    } catch (err) {
      setError('Ошибка при создании тега');
      console.error('Error creating event tag:', err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !editingTag) return;

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

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Теги мероприятий</h3>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Добавить тег
        </button>
      </div>

      {/* Форма создания */}
      {showCreateForm && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Создать новый тег</h4>
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ name: e.target.value })}
              placeholder="Название тега"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm"
            >
              Создать
            </button>
            <button
              type="button"
              onClick={cancelCreate}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
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
            <div key={tag.id} className="bg-white border border-gray-200 rounded-lg p-4">
              {editingTag?.id === tag.id ? (
                /* Форма редактирования */
                <form onSubmit={handleUpdate} className="flex gap-2">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ name: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm"
                  >
                    Отмена
                  </button>
                </form>
              ) : (
                /* Отображение тега */
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-gray-900">{tag.name}</h4>
                    <p className="text-sm text-gray-500">slug: {tag.slug}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(tag)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(tag.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
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

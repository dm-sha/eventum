import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { listEventWaves, createEventWave, updateEventWave, deleteEventWave } from '../../api/eventWave';
import type { EventWave } from '../../api/eventWave';
import { getSubdomainSlug } from '../../utils/eventumSlug';
import { eventTagApi } from '../../api/eventTag';
import { getEventsForEventum } from '../../api/event';

type Mode = 'view' | 'edit' | 'create';

interface WaveCardProps {
  wave: EventWave;
  mode: Mode;
  onStartEdit: () => void;
  onDelete: () => void;
  onSave: (name: string) => void;
}

const WaveCard: React.FC<WaveCardProps> = ({ wave, mode, onStartEdit, onDelete, onSave }) => {
  const [name, setName] = useState(wave.name);

  useEffect(() => setName(wave.name), [wave.name]);

  const capacityInfo = (max?: number | null, reg?: number) => {
    if (max == null) return 'без лимита';
    return `${reg ?? 0} / ${max}`;
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      {mode === 'edit' ? (
        /* Форма редактирования */
        <form onSubmit={(e) => { e.preventDefault(); onSave(name.trim()); }} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Название волны"
            required
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Удалить
          </button>
        </form>
      ) : (
        /* Отображение волны */
        <div className="space-y-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-gray-900">{wave.name}</h4>
              <p className="text-sm text-gray-500">Тег: {wave.tag.name}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={onStartEdit}
                className="inline-flex items-center justify-center rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Редактировать
              </button>
            </div>
          </div>

          {/* Мероприятия под волной */}
          <div className="border-t pt-3">
            <h5 className="text-sm font-medium text-gray-700 mb-2">
              Мероприятия ({wave.events.length})
            </h5>
            {wave.events.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                Нет мероприятий с тегом волны
              </div>
            ) : (
              <div className="space-y-1">
                {wave.events.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium text-gray-800">{ev.name}</span>
                    <span className="text-gray-600">{capacityInfo(ev.max_participants, ev.registrations_count)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CreateWaveForm: React.FC<{ 
  onCreate: (name: string, tagId: number) => void; 
  onCancel: () => void;
  tags: { id: number; name: string }[];
  eventumSlug: string;
}> = ({ onCreate, onCancel, tags, eventumSlug }) => {
  const [name, setName] = useState('');
  const [tagId, setTagId] = useState<number | ''>('');
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const loadEventsForTag = async (selectedTagId: number) => {
    if (!eventumSlug) return;
    
    setLoadingEvents(true);
    try {
      // Получаем все события с выбранным тегом
      const allEvents = await getEventsForEventum(eventumSlug);
      const eventsWithTag = allEvents.filter((event: any) => 
        event.tags.some((tag: any) => tag.id === selectedTagId)
      );
      setEvents(eventsWithTag);
    } catch (error) {
      console.error('Error loading events:', error);
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleTagChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTagId = e.target.value ? Number(e.target.value) : '';
    setTagId(newTagId);
    if (newTagId) {
      loadEventsForTag(newTagId);
    } else {
      setEvents([]);
    }
  };

  const hasInvalidEvents = events.some(event => event.participant_type !== 'registration');
  const canSave = name.trim() && tagId && !hasInvalidEvents;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onCreate(name.trim(), Number(tagId));
    setName('');
    setTagId('');
    setEvents([]);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h4 className="text-base font-semibold text-gray-900">Создать новую волну</h4>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название волны"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            required
          />
        </div>
        <div>
          <select
            value={tagId}
            onChange={handleTagChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            required
          >
            <option value="">— выберите тег —</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Предварительный просмотр мероприятий */}
        {tagId && (
          <div className="border-t pt-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">
              Мероприятия с выбранным тегом ({events.length})
            </h5>
            {loadingEvents ? (
              <div className="text-sm text-gray-500">Загрузка мероприятий...</div>
            ) : events.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                Нет мероприятий с выбранным тегом
              </div>
            ) : (
              <div className="space-y-1">
                {events.map((event) => {
                  const isInvalid = event.participant_type !== 'registration';
                  return (
                    <div
                      key={event.id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        isInvalid 
                          ? 'border-red-200 bg-red-50 text-red-800' 
                          : 'border-green-200 bg-green-50 text-green-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{event.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            isInvalid 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {event.participant_type === 'registration' ? 'По записи' : 
                             event.participant_type === 'all' ? 'Для всех' : 'Вручную'}
                          </span>
                          {isInvalid && (
                            <span className="text-red-600 text-xs">⚠️</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {hasInvalidEvents && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                ⚠️ Некоторые мероприятия не имеют тип "По записи". Сначала измените тип участников у этих мероприятий.
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={!canSave}
            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {hasInvalidEvents ? 'Исправьте мероприятия' : 'Создать'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

const EventRegistrationWavesPage: React.FC = () => {
  const { eventumSlug: urlSlug } = useParams<{ eventumSlug?: string }>();
  const subdomainSlug = getSubdomainSlug();
  const eventumSlug = useMemo(() => subdomainSlug || urlSlug || '', [subdomainSlug, urlSlug]);
  const [waves, setWaves] = useState<EventWave[]>([]);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<{ id: number; name: string }[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  

  const load = async () => {
    if (!eventumSlug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [ws, ets] = await Promise.all([
        listEventWaves(eventumSlug),
        eventTagApi.getEventTags(eventumSlug),
      ]);
      setWaves(ws);
      setTags(ets.map(t => ({ id: t.id, name: t.name })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [eventumSlug]);

  const handleCreate = async (name: string, tagId: number) => {
    if (!eventumSlug) return;
    await createEventWave(eventumSlug, { name, tag_id: tagId });
    setShowCreateForm(false);
    await load();
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
  };

  const handleSave = async (id: number, name: string) => {
    if (!eventumSlug) return;
    await updateEventWave(eventumSlug, id, { name });
    setEditingId(null);
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!eventumSlug) return;
    await deleteEventWave(eventumSlug, id);
    await load();
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Регистрация на мероприятия</h1>
      <div className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">Волны регистрации</h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Добавить волну
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {showCreateForm && (
            <CreateWaveForm 
              onCreate={handleCreate} 
              onCancel={handleCancelCreate}
              tags={tags}
              eventumSlug={eventumSlug}
            />
          )}

          {loading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : waves.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Волны регистрации не найдены. Создайте первую волну.
            </div>
          ) : (
            waves.map((w) => (
              <WaveCard
                key={w.id}
                wave={w}
                mode={editingId === w.id ? 'edit' : 'view'}
                onStartEdit={() => setEditingId(w.id)}
                onDelete={() => handleDelete(w.id)}
                onSave={(name) => handleSave(w.id, name)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default EventRegistrationWavesPage;

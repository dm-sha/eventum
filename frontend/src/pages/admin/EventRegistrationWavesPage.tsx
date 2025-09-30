import { useEffect, useMemo, useState } from 'react';
import { listEventWaves, createEventWave, updateEventWave, deleteEventWave } from '../../api/eventWave';
import type { EventWave } from '../../api/eventWave';
import { useAuth } from '../../contexts/AuthContext';
import { getSubdomainSlug } from '../../utils/eventumSlug';
import { eventTagApi } from '../../api/eventTag';

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
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex items-center justify-between">
        {mode === 'edit' ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded px-2 py-1 w-full max-w-md"
            placeholder="Название волны"
          />
        ) : (
          <h3 className="text-lg font-semibold">{wave.name}</h3>
        )}

        {mode === 'edit' ? (
          <button
            onClick={onDelete}
            className="ml-3 text-red-600 hover:text-red-700"
            title="Удалить волну"
            aria-label="Удалить волну"
          >
            ✕
          </button>
        ) : (
          <button
            onClick={onStartEdit}
            className="ml-3 text-gray-600 hover:text-gray-800"
            title="Редактировать"
            aria-label="Редактировать"
          >
            ✎
          </button>
        )}
      </div>

      <div className="mt-2 text-sm text-gray-600">
        <div>
          <span className="font-medium">Тег волны:</span> {wave.tag.name}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-sm font-medium mb-2">Мероприятия</div>
        <div className="space-y-1">
          {wave.events.map((ev) => (
            <div key={ev.id} className="flex justify-between text-sm bg-gray-50 rounded px-2 py-1">
              <span>{ev.name}</span>
              <span className="text-gray-600">{capacityInfo(ev.max_participants, ev.registrations_count)}</span>
            </div>
          ))}
          {!wave.events.length && (
            <div className="text-sm text-gray-500">Нет мероприятий с тегом волны</div>
          )}
        </div>
      </div>

      {mode === 'edit' && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onSave(name.trim())}
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Сохранить
          </button>
        </div>
      )}
    </div>
  );
};

const CreateWaveCard: React.FC<{ onCreate: (name: string, tagId: number) => void; tags: { id: number; name: string }[] }>
  = ({ onCreate, tags }) => {
  const [name, setName] = useState('');
  const [tagId, setTagId] = useState<number | ''>('');

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-dashed border-gray-300">
      <div className="flex items-center justify-between">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-2 py-1 w-full max-w-md"
          placeholder="Название волны"
        />
      </div>
      <div className="mt-3">
        <label className="block text-sm mb-1">Тег волны</label>
        <select
          value={tagId}
          onChange={(e) => setTagId(e.target.value ? Number(e.target.value) : '')}
          className="border rounded px-2 py-1"
        >
          <option value="">— выберите тег —</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="mt-4">
        <button
          onClick={() => {
            if (!name.trim() || !tagId) return;
            onCreate(name.trim(), Number(tagId));
            setName('');
            setTagId('');
          }}
          className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
        >
          Добавить волну
        </button>
      </div>
    </div>
  );
};

const EventRegistrationWavesPage: React.FC = () => {
  const subdomainSlug = getSubdomainSlug();
  const eventumSlug = useMemo(() => subdomainSlug || '', [subdomainSlug]);
  const [waves, setWaves] = useState<EventWave[]>([]);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<{ id: number; name: string }[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = async () => {
    if (!eventumSlug) return;
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
    await load();
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
        <h2 className="text-xl font-semibold">Волны регистрации</h2>
        <div className="mt-4 space-y-3">
          <CreateWaveCard onCreate={handleCreate} tags={tags} />

          {loading ? (
            <div>Загрузка...</div>
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



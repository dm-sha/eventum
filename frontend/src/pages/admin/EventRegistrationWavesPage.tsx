import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { listEventWaves, createEventWave, updateEventWave, deleteEventWave } from '../../api/eventWave';
import type { EventWave } from '../../api/eventWave';
import { getSubdomainSlug } from '../../utils/eventumSlug';
import { eventTagApi } from '../../api/eventTag';
import { getEventsForEventum } from '../../api/event';
import { IconPencil, IconTrash, IconCheck, IconX } from '../../components/icons';
import { getGroupsForEventum } from '../../api/group';
import { groupTagApi } from '../../api/groupTag';

type Mode = 'view' | 'edit' | 'create';

interface WaveCardProps {
  wave: EventWave;
  mode: Mode;
  onStartEdit: () => void;
  onDelete: () => void;
  onSave: (data: { name: string; whitelist_group_ids?: number[]; whitelist_group_tag_ids?: number[]; blacklist_group_ids?: number[]; blacklist_group_tag_ids?: number[] }) => void;
  onCancel: () => void;
  groups: { id: number; name: string }[];
  groupTags: { id: number; name: string }[];
}

const WaveCard: React.FC<WaveCardProps> = ({ wave, mode, onStartEdit, onDelete, onSave, onCancel, groups, groupTags }) => {
  const [name, setName] = useState(wave.name);
  const [whitelistItems, setWhitelistItems] = useState<Array<{id: number, name: string, type: 'group' | 'tag'}>>([]);
  const [blacklistItems, setBlacklistItems] = useState<Array<{id: number, name: string, type: 'group' | 'tag'}>>([]);
  const [whitelistQuery, setWhitelistQuery] = useState('');
  const [blacklistQuery, setBlacklistQuery] = useState('');
  const [showWhitelistSuggestions, setShowWhitelistSuggestions] = useState(false);
  const [showBlacklistSuggestions, setShowBlacklistSuggestions] = useState(false);
  const whitelistInputRef = useRef<HTMLDivElement>(null);
  const blacklistInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(wave.name);
    const whitelist = [
      ...wave.whitelist_groups.map(g => ({ id: g.id, name: g.name, type: 'group' as const })),
      ...wave.whitelist_group_tags.map(t => ({ id: t.id, name: t.name, type: 'tag' as const }))
    ];
    const blacklist = [
      ...wave.blacklist_groups.map(g => ({ id: g.id, name: g.name, type: 'group' as const })),
      ...wave.blacklist_group_tags.map(t => ({ id: t.id, name: t.name, type: 'tag' as const }))
    ];
    setWhitelistItems(whitelist);
    setBlacklistItems(blacklist);
  }, [wave]);

  const capacityInfo = (max?: number | null, reg?: number) => {
    if (max == null) return 'без лимита';
    return `${reg ?? 0} / ${max}`;
  };

  // Функции для работы с саджестами
  const getWhitelistSuggestions = () => {
    const query = whitelistQuery.toLowerCase();
    const allItems = [
      ...groups.map(g => ({ id: g.id, name: g.name, type: 'group' as const })),
      ...groupTags.map(t => ({ id: t.id, name: t.name, type: 'tag' as const }))
    ];
    
    return allItems.filter(item => 
      item.name.toLowerCase().includes(query) && 
      !whitelistItems.some(selected => selected.id === item.id && selected.type === item.type)
    );
  };

  const getBlacklistSuggestions = () => {
    const query = blacklistQuery.toLowerCase();
    const allItems = [
      ...groups.map(g => ({ id: g.id, name: g.name, type: 'group' as const })),
      ...groupTags.map(t => ({ id: t.id, name: t.name, type: 'tag' as const }))
    ];
    
    return allItems.filter(item => 
      item.name.toLowerCase().includes(query) && 
      !blacklistItems.some(selected => selected.id === item.id && selected.type === item.type)
    );
  };

  const addToWhitelist = (item: {id: number, name: string, type: 'group' | 'tag'}) => {
    setWhitelistItems([...whitelistItems, item]);
    setWhitelistQuery('');
    setShowWhitelistSuggestions(false);
  };

  const addToBlacklist = (item: {id: number, name: string, type: 'group' | 'tag'}) => {
    setBlacklistItems([...blacklistItems, item]);
    setBlacklistQuery('');
    setShowBlacklistSuggestions(false);
  };

  const removeFromWhitelist = (id: number, type: 'group' | 'tag') => {
    setWhitelistItems(whitelistItems.filter(item => !(item.id === id && item.type === type)));
  };

  const removeFromBlacklist = (id: number, type: 'group' | 'tag') => {
    setBlacklistItems(blacklistItems.filter(item => !(item.id === id && item.type === type)));
  };

  // Обработка кликов вне области ввода
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (whitelistInputRef.current && !whitelistInputRef.current.contains(event.target as Node)) {
        setShowWhitelistSuggestions(false);
      }
      if (blacklistInputRef.current && !blacklistInputRef.current.contains(event.target as Node)) {
        setShowBlacklistSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            {mode === 'edit' ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Название волны"
                required
                autoFocus
              />
            ) : (
              <h4 className="text-base font-semibold text-gray-900">{wave.name}</h4>
            )}
            <p className="text-sm text-gray-500">Тег: {wave.tag.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'edit' ? (
              <>
                <button
                  onClick={() => {
                    const whitelistGroups = whitelistItems.filter(item => item.type === 'group').map(item => item.id);
                    const whitelistGroupTags = whitelistItems.filter(item => item.type === 'tag').map(item => item.id);
                    const blacklistGroups = blacklistItems.filter(item => item.type === 'group').map(item => item.id);
                    const blacklistGroupTags = blacklistItems.filter(item => item.type === 'tag').map(item => item.id);
                    
                    onSave({
                      name: name.trim(),
                      whitelist_group_ids: whitelistGroups,
                      whitelist_group_tag_ids: whitelistGroupTags,
                      blacklist_group_ids: blacklistGroups,
                      blacklist_group_tag_ids: blacklistGroupTags
                    });
                  }}
                  className="inline-flex items-center justify-center rounded-lg bg-green-600 p-2 text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  title="Сохранить"
                >
                  <IconCheck size={16} />
                </button>
                <button
                  onClick={onCancel}
                  className="inline-flex items-center justify-center rounded-lg bg-gray-200 p-2 text-gray-700 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                  title="Отмена"
                >
                  <IconX size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onStartEdit}
                  className="inline-flex items-center justify-center rounded-lg border border-blue-200 p-2 text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  title="Редактировать"
                >
                  <IconPencil size={16} />
                </button>
                <button
                  onClick={onDelete}
                  className="inline-flex items-center justify-center rounded-lg border border-red-200 p-2 text-red-700 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  title="Удалить"
                >
                  <IconTrash size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Информация о фильтрах (только если есть ограничения и не в режиме редактирования) */}
        {mode !== 'edit' && (whitelistItems.length > 0 || blacklistItems.length > 0) && (
          <div className="border-t pt-3">
            <div className="space-y-2 text-xs text-gray-600">
              {whitelistItems.length > 0 && (
                <div>
                  <span className="font-medium text-green-700">Доступен для:</span>{' '}
                  {whitelistItems.map(item => item.name).join(', ')}
                </div>
              )}
              {blacklistItems.length > 0 && (
                <div>
                  <span className="font-medium text-red-700">Недоступен для:</span>{' '}
                  {blacklistItems.map(item => item.name).join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Поля редактирования фильтров (только в режиме редактирования) */}
        {mode === 'edit' && (
          <div className="border-t pt-3">
            <h5 className="text-sm font-medium text-gray-700 mb-3">Настройка доступа к волне</h5>
            <div className="space-y-4">
              {/* Whitelist */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Группы, которые учавствуют в мероприятях волны
                </label>
                
                {/* Поле ввода с саджестом */}
                <div ref={whitelistInputRef} className="relative mb-3">
                  <input
                    type="text"
                    value={whitelistQuery}
                    onChange={(e) => setWhitelistQuery(e.target.value)}
                    onFocus={() => setShowWhitelistSuggestions(true)}
                    onClick={() => setShowWhitelistSuggestions(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowWhitelistSuggestions(false);
                      }
                    }}
                    placeholder="Добавить группу или тег..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  />
                  
                  {/* Саджесты */}
                  {showWhitelistSuggestions && getWhitelistSuggestions().length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-32 overflow-y-auto">
                      {getWhitelistSuggestions().map((item) => (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          onClick={() => addToWhitelist(item)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Показать выбранные элементы */}
                {whitelistItems.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {whitelistItems.map((item) => (
                      <span
                        key={`${item.type}-${item.id}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                          item.type === 'group' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {item.name}
                        <button
                          type="button"
                          onClick={() => removeFromWhitelist(item.id, item.type)}
                          className={`ml-1 hover:opacity-80 ${
                            item.type === 'group' 
                              ? 'text-blue-600' 
                              : 'text-purple-600'
                          }`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Blacklist */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Группы, которые не учавствуют в мероприятях волны
                </label>
                
                {/* Поле ввода с саджестом */}
                <div ref={blacklistInputRef} className="relative mb-3">
                  <input
                    type="text"
                    value={blacklistQuery}
                    onChange={(e) => setBlacklistQuery(e.target.value)}
                    onFocus={() => setShowBlacklistSuggestions(true)}
                    onClick={() => setShowBlacklistSuggestions(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowBlacklistSuggestions(false);
                      }
                    }}
                    placeholder="Добавить группу или тег..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  />
                  
                  {/* Саджесты */}
                  {showBlacklistSuggestions && getBlacklistSuggestions().length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-32 overflow-y-auto">
                      {getBlacklistSuggestions().map((item) => (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          onClick={() => addToBlacklist(item)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Показать выбранные элементы */}
                {blacklistItems.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {blacklistItems.map((item) => (
                      <span
                        key={`${item.type}-${item.id}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                          item.type === 'group' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {item.name}
                        <button
                          type="button"
                          onClick={() => removeFromBlacklist(item.id, item.type)}
                          className={`ml-1 hover:opacity-80 ${
                            item.type === 'group' 
                              ? 'text-red-600' 
                              : 'text-orange-600'
                          }`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">Никто не исключен</div>
                )}
              </div>
            </div>
          </div>
        )}

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
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [groupTags, setGroupTags] = useState<{ id: number; name: string }[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  

  const load = async () => {
    if (!eventumSlug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [ws, ets, gs, gts] = await Promise.all([
        listEventWaves(eventumSlug),
        eventTagApi.getEventTags(eventumSlug),
        getGroupsForEventum(eventumSlug),
        groupTagApi.getGroupTags(eventumSlug),
      ]);
      setWaves(ws);
      setTags(ets.map(t => ({ id: t.id, name: t.name })));
      setGroups(gs.map((g: any) => ({ id: g.id, name: g.name })));
      setGroupTags(gts.map((t: any) => ({ id: t.id, name: t.name })));
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

  const handleSave = async (id: number, data: { name: string; whitelist_group_ids?: number[]; whitelist_group_tag_ids?: number[]; blacklist_group_ids?: number[]; blacklist_group_tag_ids?: number[] }) => {
    if (!eventumSlug) return;
    await updateEventWave(eventumSlug, id, data);
    setEditingId(null);
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!eventumSlug) return;
    await deleteEventWave(eventumSlug, id);
    await load();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
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
                onSave={(data) => handleSave(w.id, data)}
                onCancel={handleCancelEdit}
                groups={groups}
                groupTags={groupTags}
              />
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default EventRegistrationWavesPage;

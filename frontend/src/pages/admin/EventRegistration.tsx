import { useEffect, useState, useRef } from 'react';
import { listEventWaves, createEventWave, updateEventWave, deleteEventWave } from '../../api/eventWave';
import type { EventWave } from '../../api/eventWave';
import { eventTagApi } from '../../api/eventTag';
import { getEventsForEventum } from '../../api/event';
import { IconPencil, IconTrash, IconCheck, IconX, IconPlus, IconInformationCircle, IconUsersCircle } from '../../components/icons';
import { getGroupsForEventum } from '../../api/group';
import { groupTagApi } from '../../api/groupTag';
import { useEventumSlug } from '../../hooks/useEventumSlug';
import WavesLoadingSkeleton from '../../components/admin/skeletons/WavesLoadingSkeleton';
import { eventumApi, eventsApi } from '../../api/eventumApi';
import { getEventumBySlug } from '../../api/eventum';
import type { Eventum } from '../../types';

type Mode = 'view' | 'edit' | 'create';

interface FilterItem {
  id: number;
  name: string;
  type: 'group' | 'tag';
}

interface FilterSelectorProps {
  label: string;
  items: FilterItem[];
  selectedItems: FilterItem[];
  onAdd: (item: FilterItem) => void;
  onRemove: (id: number, type: 'group' | 'tag') => void;
  placeholder: string;
  colorScheme: 'green' | 'red';
}

const FilterSelector: React.FC<FilterSelectorProps> = ({
  label,
  items,
  selectedItems,
  onAdd,
  onRemove,
  placeholder,
  colorScheme
}) => {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  const suggestions = items.filter(item => 
    item.name.toLowerCase().includes(query.toLowerCase()) && 
    !selectedItems.some(selected => selected.id === item.id && selected.type === item.type)
  );

  const handleAdd = (item: FilterItem) => {
    onAdd(item);
    setQuery('');
    setShowSuggestions(false);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isGreen = colorScheme === 'green';
  const focusColor = isGreen ? 'focus:border-green-500 focus:ring-green-200' : 'focus:border-red-500 focus:ring-red-200';
  const badgeColor = isGreen 
    ? 'bg-green-100 text-green-800' 
    : 'bg-red-100 text-red-800';
  const badgeTextColor = isGreen ? 'text-green-600' : 'text-red-600';

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      
      <div ref={inputRef} className="relative mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onClick={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowSuggestions(false);
            }
          }}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 ${focusColor}`}
        />
        
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-32 overflow-y-auto">
            {suggestions.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                onClick={() => handleAdd(item)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <span
              key={`${item.type}-${item.id}`}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                item.type === 'group' 
                  ? badgeColor
                  : isGreen 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-orange-100 text-orange-800'
              }`}
            >
              {item.name}
              <button
                type="button"
                onClick={() => onRemove(item.id, item.type)}
                className={`ml-1 hover:opacity-80 ${
                  item.type === 'group' 
                    ? badgeTextColor
                    : isGreen 
                      ? 'text-purple-600' 
                      : 'text-orange-600'
                }`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

interface WaveCardProps {
  wave: EventWave;
  mode: Mode;
  onStartEdit: () => void;
  onDelete: () => void;
  onSave: (data: { name: string; whitelist_group_ids?: number[]; whitelist_group_tag_ids?: number[]; blacklist_group_ids?: number[]; blacklist_group_tag_ids?: number[] }) => void;
  onCancel: () => void;
  onConvertEventRegistrations: (eventId: number) => Promise<void>;
  onConvertEventRegistrationsStrict: (eventId: number) => Promise<void>;
  groups: { id: number; name: string }[];
  groupTags: { id: number; name: string }[];
}

const WaveCard: React.FC<WaveCardProps> = ({ wave, mode, onStartEdit, onDelete, onSave, onCancel, onConvertEventRegistrations, onConvertEventRegistrationsStrict, groups, groupTags }) => {
  const [name, setName] = useState(wave.name);
  const [whitelistItems, setWhitelistItems] = useState<FilterItem[]>([]);
  const [blacklistItems, setBlacklistItems] = useState<FilterItem[]>([]);

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

  const handleConvertEventRegistrations = async (eventId: number) => {
    const confirmed = confirm(
      `Вы уверены, что хотите записать доступных участников на это мероприятие? ` +
      `Это изменит тип участников на "Вручную" и запишет только тех участников, которые еще не распределены на другие мероприятия волны.`
    );
    
    if (confirmed) {
      await onConvertEventRegistrations(eventId);
    }
  };

  const handleConvertEventRegistrationsStrict = async (eventId: number) => {
    const confirmed = confirm(
      `Вы уверены, что хотите записать участников на это мероприятие в строгом режиме? ` +
      `Это запишет только тех участников, которые не имеют заявок на мероприятия, где еще не было распределения. ` +
      `Это изменит тип участников на "Вручную".`
    );
    
    if (confirmed) {
      await onConvertEventRegistrationsStrict(eventId);
    }
  };

  const allItems: FilterItem[] = [
    ...groups.map(g => ({ id: g.id, name: g.name, type: 'group' as const })),
    ...groupTags.map(t => ({ id: t.id, name: t.name, type: 'tag' as const }))
  ];

  const addToWhitelist = (item: FilterItem) => {
    setWhitelistItems([...whitelistItems, item]);
  };

  const addToBlacklist = (item: FilterItem) => {
    setBlacklistItems([...blacklistItems, item]);
  };

  const removeFromWhitelist = (id: number, type: 'group' | 'tag') => {
    setWhitelistItems(whitelistItems.filter(item => !(item.id === id && item.type === type)));
  };

  const removeFromBlacklist = (id: number, type: 'group' | 'tag') => {
    setBlacklistItems(blacklistItems.filter(item => !(item.id === id && item.type === type)));
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="space-y-3">
        {mode === 'edit' ? (
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Название волны"
              required
              autoFocus
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Тег: {wave.tag.name}</p>
              <button
                onClick={onDelete}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Удалить"
              >
                <IconTrash size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-gray-900">{wave.name}</h4>
              <p className="text-sm text-gray-500">Тег: {wave.tag.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onStartEdit}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Редактировать"
              >
                <IconPencil size={16} />
              </button>
            </div>
          </div>
        )}

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
              <FilterSelector
                label="Группы, которые участвуют в мероприятиях волны"
                items={allItems}
                selectedItems={whitelistItems}
                onAdd={addToWhitelist}
                onRemove={removeFromWhitelist}
                placeholder="Добавить группу или тег..."
                colorScheme="green"
              />

              <FilterSelector
                label="Группы, которые не участвуют в мероприятиях волны"
                items={allItems}
                selectedItems={blacklistItems}
                onAdd={addToBlacklist}
                onRemove={removeFromBlacklist}
                placeholder="Добавить группу или тег..."
                colorScheme="red"
              />
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
                  <div className="flex-1">
                    <span className="font-medium text-gray-800">{ev.name}</span>
                    <div className="mt-1 text-xs text-gray-500">
                      <div>Места: {capacityInfo(ev.max_participants, ev.assigned_participants_count)}</div>
                      <div>Заявки: {ev.registrations_count}</div>
                      <div>Доступно: {ev.available_participants}</div>
                      {ev.already_assigned_count > 0 && (
                        <div className="text-orange-600">Уже распределено: {ev.already_assigned_count}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ev.can_convert && (
                      <button
                        onClick={() => handleConvertEventRegistrations(ev.id)}
                        className="p-1 rounded text-xs bg-green-600 text-white hover:bg-green-700 transition-colors"
                        title={`Записать ${ev.available_participants} доступных участников`}
                      >
                        Записать ({ev.available_participants})
                      </button>
                    )}
                    {ev.can_convert && ev.available_without_unassigned_events > 0 && ev.available_without_unassigned_events !== ev.available_participants && (
                      <button
                        onClick={() => handleConvertEventRegistrationsStrict(ev.id)}
                        className="p-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        title={`Записать ${ev.available_without_unassigned_events} участников без заявок на нераспределенные мероприятия`}
                      >
                        Строго ({ev.available_without_unassigned_events})
                      </button>
                    )}
                    {ev.can_convert && ev.available_without_unassigned_events === 0 && (
                      <button
                        disabled
                        className="p-1 rounded text-xs bg-gray-400 text-gray-200 cursor-not-allowed"
                        title="Нет участников для строгого режима (все имеют заявки на нераспределенные мероприятия)"
                      >
                        Строго (0)
                      </button>
                    )}
                    {ev.participant_type === 'manual' && ev.available_participants === 0 && ev.registrations_count > 0 && (
                      <span className="text-xs text-gray-400">
                        Все распределены
                      </span>
                    )}
                    {ev.participant_type === 'registration' && !ev.can_convert && (
                      <span className="text-xs text-gray-400">
                        {ev.registrations_count === 0
                          ? 'Нет заявок'
                          : ev.max_participants && ev.available_participants > ev.max_participants
                            ? 'Превышен лимит'
                            : 'Нельзя конвертировать'
                        }
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Кнопки сохранения/отмены в режиме редактирования */}
        {mode === 'edit' && (
          <div className="border-t pt-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
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
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <IconCheck size={16} className="mr-2" />
                Сохранить
              </button>
              <button
                onClick={onCancel}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                <IconX size={16} className="mr-2" />
                Отмена
              </button>
            </div>
          </div>
        )}
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

  const canSave = name.trim() && tagId;

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
      <h4 className="text-lg font-semibold text-gray-900">Создать новую волну</h4>
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
                  return (
                    <div
                      key={event.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{event.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {event.participant_type === 'registration' ? 'По записи' : 
                             event.participant_type === 'all' ? 'Для всех' : 'Вручную'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={!canSave}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Создать
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

const EventRegistration: React.FC = () => {
  const eventumSlug = useEventumSlug();
  const [activeTab, setActiveTab] = useState<'waves' | 'distribution'>('waves');
  const [eventum, setEventum] = useState<Eventum | null>(null);
  const [waves, setWaves] = useState<EventWave[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tags, setTags] = useState<{ id: number; name: string }[]>([]);
  const [groups, setGroups] = useState<{ id: number; name: string }[]>([]);
  const [groupTags, setGroupTags] = useState<{ id: number; name: string }[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [registrationStats, setRegistrationStats] = useState<{
    registered_participants_count: number;
  } | null>(null);

  const load = async () => {
    if (!eventumSlug) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [eventumData, ws, ets, gs, gts, stats] = await Promise.all([
        getEventumBySlug(eventumSlug),
        listEventWaves(eventumSlug),
        eventTagApi.getEventTags(eventumSlug),
        getGroupsForEventum(eventumSlug),
        groupTagApi.getGroupTags(eventumSlug),
        eventumApi.getRegistrationStats(eventumSlug).then(response => response.data).catch(() => null),
      ]);
      setEventum(eventumData);
      setWaves(ws);
      setTags(ets.map(t => ({ id: t.id, name: t.name })));
      setGroups(gs.map((g: any) => ({ id: g.id, name: g.name })));
      setGroupTags(gts.map((t: any) => ({ id: t.id, name: t.name })));
      setRegistrationStats(stats);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [eventumSlug]);

  const filteredWaves = waves.filter(wave =>
    wave.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wave.tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    if (!eventumSlug || !confirm('Вы уверены, что хотите удалить эту волну?')) return;
    await deleteEventWave(eventumSlug, id);
    await load();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleConvertEventRegistrations = async (eventId: number) => {
    if (!eventumSlug) return;
    
    try {
      const result = await eventsApi.convertRegistrationsToParticipants(eventId, eventumSlug);
      
      // Перезагружаем данные
      await load();
      
      const responseData = result.data as {
        status: string;
        message: string;
        participants_count: number;
        added_participants_count: number;
        total_registrations: number;
        already_assigned_count: number;
      };
      
      alert(
        `Успешно добавлено ${responseData.added_participants_count} участников к мероприятию! ` +
        `Всего участников на мероприятии: ${responseData.participants_count}, ` +
        `всего заявок было: ${responseData.total_registrations}, ` +
        `уже распределено на другие мероприятия: ${responseData.already_assigned_count}`
      );
    } catch (error: any) {
      console.error('Error converting event registrations:', error);
      
      // Показываем более детальную ошибку
      if (error.response?.data?.error) {
        alert(`Ошибка при записи участников: ${error.response.data.error}`);
      } else {
        alert('Ошибка при записи участников. Попробуйте еще раз.');
      }
    }
  };

  const handleConvertEventRegistrationsStrict = async (eventId: number) => {
    const confirmed = confirm(
      `Вы уверены, что хотите записать участников на это мероприятие в строгом режиме? ` +
      `Это запишет только тех участников, которые не имеют заявок на мероприятия, где еще не было распределения. ` +
      `Это изменит тип участников на "Вручную".`
    );
    
    if (!confirmed) return;
    
    if (!eventumSlug) return;
    
    try {
      const result = await eventsApi.convertRegistrationsToParticipantsStrict(eventId, eventumSlug);
      
      // Перезагружаем данные
      await load();
      
      const responseData = result.data as {
        status: string;
        message: string;
        participants_count: number;
        added_participants_count: number;
        total_registrations: number;
        already_assigned_count: number;
      };
      
      alert(
        `Успешно добавлено ${responseData.added_participants_count} участников к мероприятию в строгом режиме! ` +
        `Всего участников на мероприятии: ${responseData.participants_count}, ` +
        `всего заявок было: ${responseData.total_registrations}, ` +
        `уже распределено на другие мероприятия: ${responseData.already_assigned_count}`
      );
    } catch (error: any) {
      console.error('Error converting event registrations in strict mode:', error);
      
      // Показываем более детальную ошибку
      if (error.response?.data?.error) {
        alert(`Ошибка при записи участников в строгом режиме: ${error.response.data.error}`);
      } else {
        alert('Ошибка при записи участников в строгом режиме. Попробуйте еще раз.');
      }
    }
  };

  const handleToggleRegistration = async () => {
    if (!eventumSlug || !eventum) return;
    try {
      const updatedEventum = await eventumApi.toggleRegistration(eventumSlug);
      setEventum(updatedEventum.data);
    } catch (error) {
      console.error('Error toggling registration:', error);
    }
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
          <h2 className="text-2xl font-semibold text-gray-900">Регистрация и распределение</h2>
          <div className="group relative">
            <IconInformationCircle size={20} className="text-gray-400 cursor-help" />
            <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-normal w-80 z-50">
              Управление волнами регистрации и распределением участников по мероприятиям.
            </div>
          </div>
        </div>
      </header>

      {/* Вкладки */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('waves')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'waves'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Волны регистрации
          </button>
          <button
            onClick={() => setActiveTab('distribution')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'distribution'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Распределение
          </button>
        </nav>
      </div>

      {/* Содержимое вкладок */}
      {activeTab === 'waves' && (
        <div className="space-y-6">
          {/* Переключатель регистрации */}
          {eventum && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${eventum.registration_open ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium text-gray-700">
                  Регистрация {eventum.registration_open ? 'открыта' : 'закрыта'}
                </span>
              </div>
              <button
                onClick={handleToggleRegistration}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  eventum.registration_open
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {eventum.registration_open ? 'Закрыть регистрацию' : 'Открыть регистрацию'}
              </button>
            </div>
          )}

          {/* Поиск */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск волн..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              Показано: {filteredWaves.length}
            </span>
          </div>

          {/* Кнопка добавления волны */}
          <div className="flex justify-start">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <IconPlus size={16} />
              Добавить волну
            </button>
          </div>

          {/* Список волн */}
          {isLoading ? (
            <WavesLoadingSkeleton />
          ) : (
            <div className="space-y-4">
              {showCreateForm && (
                <CreateWaveForm 
                  onCreate={handleCreate} 
                  onCancel={handleCancelCreate}
                  tags={tags}
                  eventumSlug={eventumSlug}
                />
              )}

              {filteredWaves.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                  {searchQuery 
                    ? "Подходящих волн не найдено" 
                    : "Волны регистрации не найдены. Создайте первую волну."
                  }
                </div>
              ) : (
                filteredWaves.map((w) => (
                  <WaveCard
                    key={w.id}
                    wave={w}
                    mode={editingId === w.id ? 'edit' : 'view'}
                    onStartEdit={() => setEditingId(w.id)}
                    onDelete={() => handleDelete(w.id)}
                    onSave={(data) => handleSave(w.id, data)}
                    onCancel={handleCancelEdit}
                    onConvertEventRegistrations={handleConvertEventRegistrations}
                    onConvertEventRegistrationsStrict={handleConvertEventRegistrationsStrict}
                    groups={groups}
                    groupTags={groupTags}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'distribution' && (
        <div className="space-y-6">
          {/* Статистика регистраций */}
          {registrationStats && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <IconUsersCircle size={16} className="text-blue-600" />
              <span className="font-semibold text-blue-600">{registrationStats.registered_participants_count}</span>
              <span>зарегистрированных участников</span>
            </div>
          )}

          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
            Раздел распределения участников по мероприятиям будет добавлен в ближайшее время.
          </div>
        </div>
      )}
    </div>
  );
};

export default EventRegistration;

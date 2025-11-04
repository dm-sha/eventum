import { useEffect, useState, useRef } from 'react';
import { listEventWaves, createEventWave, updateEventWave, deleteEventWave } from '../../api/eventWave';
import type { EventWave } from '../../api/eventWave';
import { 
  listEventRegistrations, 
  createEventRegistration, 
  updateEventRegistration, 
  deleteEventRegistration 
} from '../../api/eventRegistration';
import type { EventRegistration } from '../../api/eventRegistration';
import { IconPencil, IconTrash, IconCheck, IconX, IconPlus, IconInformationCircle } from '../../components/icons';
import { useEventumSlug } from '../../hooks/useEventumSlug';
import WavesLoadingSkeleton from '../../components/admin/skeletons/WavesLoadingSkeleton';
import { eventumApi } from '../../api/eventumApi';
import { getEventumBySlug } from '../../api/eventum';
import type { Eventum } from '../../types';
import { eventsApi } from '../../api/eventumApi';
import { groupsV2Api } from '../../api/eventumApi';
import type { Event } from '../../types';

type Mode = 'view' | 'edit' | 'create';

interface BasicItem {
  id: number;
  name: string;
}

// Компонент карточки регистрации
interface RegistrationCardProps {
  registration: EventRegistration;
  mode: Mode;
  onStartEdit: () => void;
  onDelete: () => void;
  onSave: (data: {
    registration_type: 'button' | 'application';
    max_participants?: number | null;
    allowed_group?: number | null;
  }) => void;
  onCancel: () => void;
  groups: BasicItem[];
}

const RegistrationCard: React.FC<RegistrationCardProps> = ({
  registration,
  mode,
  onStartEdit,
  onDelete,
  onSave,
  onCancel,
  groups
}) => {
  const [registrationType, setRegistrationType] = useState<'button' | 'application'>(registration.registration_type);
  const [maxParticipants, setMaxParticipants] = useState<string>(registration.max_participants?.toString() || '');
  const [allowedGroupId, setAllowedGroupId] = useState<string>(registration.allowed_group?.toString() || '');

  useEffect(() => {
    setRegistrationType(registration.registration_type);
    setMaxParticipants(registration.max_participants?.toString() || '');
    setAllowedGroupId(registration.allowed_group?.toString() || '');
  }, [registration]);

  const capacityInfo = (max?: number | null) => {
    if (max == null) return 'без лимита';
    return `максимум ${max}`;
  };

  const registrationTypeLabel = {
    button: 'Запись по кнопке',
    application: 'По заявкам'
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="space-y-3">
        {mode === 'edit' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold text-gray-900">{registration.event.name}</h4>
              <button
                onClick={onDelete}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Удалить"
              >
                <IconTrash size={16} />
              </button>
            </div>
            
            <div className="space-y-3">
    <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Тип регистрации
      </label>
                <select
                  value={registrationType}
                  onChange={(e) => setRegistrationType(e.target.value as 'button' | 'application')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="button">Запись по кнопке</option>
                  <option value="application">По заявкам</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Максимальное количество участников
                </label>
        <input
                  type="number"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder="Без лимита"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Группа с доступом (опционально)
                </label>
                <GroupCombobox
                  groups={groups}
                  value={allowedGroupId}
                  onChange={setAllowedGroupId}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-gray-900">{registration.event.name}</h4>
              <div className="text-sm text-gray-500 space-y-1">
                <div>Тип: {registrationTypeLabel[registration.registration_type]}</div>
                <div>Места: {capacityInfo(registration.max_participants)}</div>
                <div>Зарегистрировано: {registration.registered_count} {registration.is_full && '(заполнено)'}</div>
              </div>
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

        {/* Кнопки сохранения/отмены в режиме редактирования */}
        {mode === 'edit' && (
          <div className="border-t pt-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => {
                  onSave({
                    registration_type: registrationType,
                    max_participants: maxParticipants ? parseInt(maxParticipants) : null,
                    allowed_group: allowedGroupId ? parseInt(allowedGroupId) : null
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

// Компонент combobox для выбора группы
interface GroupComboboxProps {
  groups: BasicItem[];
  value: string;
  onChange: (groupId: string) => void;
  placeholder?: string;
  emptyOptionLabel?: string;
}

const GroupCombobox: React.FC<GroupComboboxProps> = ({ 
  groups, 
  value, 
  onChange, 
  placeholder = "Введите название группы для поиска...",
  emptyOptionLabel = "Все участники"
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedGroup = groups.find(g => g.id === parseInt(value));

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedGroup) {
          setSearchQuery(selectedGroup.name);
        } else {
          setSearchQuery('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedGroup]);

  useEffect(() => {
    if (selectedGroup) {
      setSearchQuery(selectedGroup.name);
    } else if (!value) {
      setSearchQuery('');
    }
  }, [selectedGroup, value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsOpen(true);
    setHighlightedIndex(-1);
    // Не сбрасываем значение при вводе, только при полной очистке
    if (!query && value) {
      onChange('');
    }
  };

  const handleSelectGroup = (group: BasicItem | null) => {
    if (group) {
      onChange(group.id.toString());
      setSearchQuery(group.name);
    } else {
      onChange('');
      setSearchQuery('');
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    // Если поле пустое, показываем все группы
    if (!searchQuery && !value) {
      setSearchQuery('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allOptions = [{ id: 0, name: emptyOptionLabel }, ...filteredGroups];
    
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < allOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > -1 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      if (highlightedIndex === 0) {
        handleSelectGroup(null);
      } else {
        handleSelectGroup(allOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const allOptions = [{ id: 0, name: emptyOptionLabel }, ...filteredGroups];

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
          {filteredGroups.length === 0 && searchQuery ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              Группы не найдены
            </div>
          ) : (
            <>
              {filteredGroups.length < groups.length && searchQuery && (
                <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                  Найдено: {filteredGroups.length} из {groups.length}
                </div>
              )}
              <div ref={listRef} className="py-1">
                {allOptions.map((option, index) => {
                  const isSelected = index === 0 ? !value : parseInt(value) === option.id;
                  return (
                    <button
                      key={option.id || 'empty'}
                      type="button"
                      onClick={() => index === 0 ? handleSelectGroup(null) : handleSelectGroup(option)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none ${
                        index === highlightedIndex ? 'bg-blue-50' : ''
                      } ${isSelected ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
                    >
                      {option.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Компонент combobox для выбора мероприятия
interface EventComboboxProps {
  events: Event[];
  value: string;
  onChange: (eventId: string) => void;
  required?: boolean;
}

const EventCombobox: React.FC<EventComboboxProps> = ({ events, value, onChange, required = false }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedEvent = events.find(e => e.id === parseInt(value));

  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedEvent) {
          setSearchQuery(selectedEvent.name);
        } else {
          setSearchQuery('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedEvent]);

  useEffect(() => {
    if (selectedEvent) {
      setSearchQuery(selectedEvent.name);
    }
  }, [selectedEvent]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setIsOpen(true);
    setHighlightedIndex(-1);
    if (!query) {
      onChange('');
    }
  };

  const handleSelectEvent = (event: Event) => {
    onChange(event.id.toString());
    setSearchQuery(event.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredEvents.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelectEvent(filteredEvents[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder="Введите название мероприятия для поиска..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      {required && (
        <input 
          type="hidden" 
          name="event" 
          value={value || ''} 
          required={required}
          aria-label="Выбор мероприятия"
        />
      )}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
          {filteredEvents.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              Мероприятия не найдены
            </div>
          ) : (
            <>
              {filteredEvents.length < events.length && (
                <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
                  Найдено: {filteredEvents.length} из {events.length}
                </div>
              )}
              <div ref={listRef} className="py-1">
                {filteredEvents.map((event, index) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => handleSelectEvent(event)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none ${
                      index === highlightedIndex ? 'bg-blue-50' : ''
                    } ${parseInt(value) === event.id ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
                  >
                    {event.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Компонент формы создания регистрации
const CreateRegistrationForm: React.FC<{
  onCreate: (data: {
    event: number;
    registration_type: 'button' | 'application';
    max_participants?: number | null;
    allowed_group?: number | null;
  }) => void;
  onCancel: () => void;
  events: Event[];
  groups: BasicItem[];
}> = ({ onCreate, onCancel, events, groups }) => {
  const [eventId, setEventId] = useState<string>('');
  const [registrationType, setRegistrationType] = useState<'button' | 'application'>('button');
  const [maxParticipants, setMaxParticipants] = useState<string>('');
  const [allowedGroupId, setAllowedGroupId] = useState<string>('');

  const canSave = eventId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onCreate({
      event: parseInt(eventId),
      registration_type: registrationType,
      max_participants: maxParticipants ? parseInt(maxParticipants) : null,
      allowed_group: allowedGroupId ? parseInt(allowedGroupId) : null
    });
    setEventId('');
    setRegistrationType('button');
    setMaxParticipants('');
    setAllowedGroupId('');
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h4 className="text-lg font-semibold text-gray-900">Создать новую регистрацию</h4>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Мероприятие
          </label>
          <EventCombobox
            events={events}
            value={eventId}
            onChange={setEventId}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Тип регистрации
          </label>
          <select
            value={registrationType}
            onChange={(e) => setRegistrationType(e.target.value as 'button' | 'application')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="button">Запись по кнопке</option>
            <option value="application">По заявкам</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Максимальное количество участников
          </label>
          <input
            type="number"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            placeholder="Без лимита"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Группа с доступом (опционально)
          </label>
          <GroupCombobox
            groups={groups}
            value={allowedGroupId}
            onChange={setAllowedGroupId}
          />
        </div>
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

// Компонент карточки волны
interface WaveCardProps {
  wave: EventWave;
  mode: Mode;
  onStartEdit: () => void;
  onDelete: () => void;
  onSave: (data: { name: string; registration_ids?: number[] }) => void;
  onCancel: () => void;
  registrations: EventRegistration[];
}

const WaveCard: React.FC<WaveCardProps> = ({ wave, mode, onStartEdit, onDelete, onSave, onCancel, registrations }) => {
  const [name, setName] = useState(wave.name);
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<number[]>(
    wave.registrations?.map((r: any) => r.id) || []
  );

  useEffect(() => {
    setName(wave.name);
    setSelectedRegistrationIds(wave.registrations?.map((r: any) => r.id) || []);
  }, [wave]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="space-y-3">
        {mode === 'edit' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Название волны"
              required
              autoFocus
            />
              <button
                onClick={onDelete}
                className="ml-2 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Удалить"
              >
                <IconTrash size={16} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Регистрации в волне
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {registrations.map((reg) => (
                  <label key={reg.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedRegistrationIds.includes(reg.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRegistrationIds([...selectedRegistrationIds, reg.id]);
                        } else {
                          setSelectedRegistrationIds(selectedRegistrationIds.filter(id => id !== reg.id));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{reg.event.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-gray-900">{wave.name}</h4>
              <p className="text-sm text-gray-500">
                Регистраций: {wave.registrations?.length || 0} | Мероприятий: {wave.events?.length || 0}
              </p>
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

        {/* Мероприятия в волне */}
        {mode !== 'edit' && wave.events && wave.events.length > 0 && (
        <div className="border-t pt-3">
          <h5 className="text-sm font-medium text-gray-700 mb-2">
            Мероприятия ({wave.events.length})
          </h5>
            <div className="space-y-1">
              {wave.events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
                >
                    <span className="font-medium text-gray-800">{ev.name}</span>
                  <div className="text-xs text-gray-500">
                    <div>Места: {ev.max_participants ? `максимум ${ev.max_participants}` : 'без лимита'}</div>
                  </div>
                </div>
              ))}
            </div>
            </div>
          )}

        {/* Кнопки сохранения/отмены в режиме редактирования */}
        {mode === 'edit' && (
          <div className="border-t pt-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => {
                  onSave({
                    name: name.trim(),
                    registration_ids: selectedRegistrationIds
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

// Форма создания волны
const CreateWaveForm: React.FC<{ 
  onCreate: (name: string, registrationIds: number[]) => void;
  onCancel: () => void;
  registrations: EventRegistration[];
}> = ({ onCreate, onCancel, registrations }) => {
  const [name, setName] = useState('');
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<number[]>([]);

  const canSave = name.trim() && selectedRegistrationIds.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onCreate(name.trim(), selectedRegistrationIds);
    setName('');
    setSelectedRegistrationIds([]);
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Регистрации в волне
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
            {registrations.map((reg) => (
              <label key={reg.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={selectedRegistrationIds.includes(reg.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRegistrationIds([...selectedRegistrationIds, reg.id]);
                    } else {
                      setSelectedRegistrationIds(selectedRegistrationIds.filter(id => id !== reg.id));
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{reg.event.name}</span>
              </label>
            ))}
          </div>
        </div>
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

const EventRegistrationPage: React.FC = () => {
  const eventumSlug = useEventumSlug();
  const [activeTab, setActiveTab] = useState<'registrations' | 'waves'>('registrations');
  const [eventum, setEventum] = useState<Eventum | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [waves, setWaves] = useState<EventWave[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [groups, setGroups] = useState<BasicItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRegistrationId, setEditingRegistrationId] = useState<number | null>(null);
  const [editingWaveId, setEditingWaveId] = useState<number | null>(null);
  const [showCreateRegistration, setShowCreateRegistration] = useState(false);
  const [showCreateWave, setShowCreateWave] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = async () => {
    if (!eventumSlug) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [eventumData, regs, ws, evsResponse, gs] = await Promise.all([
        getEventumBySlug(eventumSlug),
        listEventRegistrations(eventumSlug),
        listEventWaves(eventumSlug),
        eventsApi.getAll(eventumSlug),
        groupsV2Api.getAll(eventumSlug, { includeEventGroups: true })
      ]);
      setEventum(eventumData);
      setRegistrations(regs);
      setWaves(ws);
      setEvents(evsResponse.data);
      setGroups(gs.data.map((g: any) => ({ id: g.id, name: g.name })));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [eventumSlug]);

  const filteredRegistrations = registrations.filter(reg =>
    reg.event.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWaves = waves.filter(wave =>
    wave.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateRegistration = async (data: {
    event: number;
    registration_type: 'button' | 'application';
    max_participants?: number | null;
    allowed_group?: number | null;
  }) => {
    if (!eventumSlug) return;
    await createEventRegistration(eventumSlug, data);
    setShowCreateRegistration(false);
    await load();
  };

  const handleUpdateRegistration = async (id: number, data: {
    registration_type: 'button' | 'application';
    max_participants?: number | null;
    allowed_group?: number | null;
  }) => {
    if (!eventumSlug) return;
    await updateEventRegistration(eventumSlug, id, data);
    setEditingRegistrationId(null);
    await load();
  };

  const handleDeleteRegistration = async (id: number) => {
    if (!eventumSlug || !confirm('Вы уверены, что хотите удалить эту регистрацию?')) return;
    await deleteEventRegistration(eventumSlug, id);
    await load();
  };

  const handleCreateWave = async (name: string, registrationIds: number[]) => {
    if (!eventumSlug) return;
    await createEventWave(eventumSlug, { name, registration_ids: registrationIds });
    setShowCreateWave(false);
    await load();
  };

  const handleUpdateWave = async (id: number, data: { name: string; registration_ids?: number[] }) => {
    if (!eventumSlug) return;
    await updateEventWave(eventumSlug, id, data);
    setEditingWaveId(null);
    await load();
  };

  const handleDeleteWave = async (id: number) => {
    if (!eventumSlug || !confirm('Вы уверены, что хотите удалить эту волну?')) return;
    await deleteEventWave(eventumSlug, id);
    await load();
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
          <h2 className="text-2xl font-semibold text-gray-900">Регистрация на мероприятия</h2>
          <div className="group relative">
            <IconInformationCircle size={20} className="text-gray-400 cursor-help" />
            <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-normal w-80 z-50">
              Управление регистрациями на мероприятия и волнами регистрации.
            </div>
          </div>
        </div>
      </header>

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

      {/* Вкладки */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('registrations')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'registrations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Регистрации
          </button>
          <button
            onClick={() => setActiveTab('waves')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'waves'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Волны
          </button>
        </nav>
      </div>

          {/* Поиск */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'registrations' ? 'Поиск регистраций...' : 'Поиск волн...'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
          Показано: {activeTab === 'registrations' ? filteredRegistrations.length : filteredWaves.length}
            </span>
          </div>

      {/* Контент вкладок */}
      {isLoading ? (
        <WavesLoadingSkeleton />
      ) : (
        <>
          {activeTab === 'registrations' ? (
            <div className="space-y-4">
              {/* Кнопка добавления регистрации */}
              <div className="flex justify-start">
                <button
                  onClick={() => setShowCreateRegistration(true)}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <IconPlus size={16} />
                  Добавить регистрацию
                </button>
              </div>

              {/* Форма создания */}
              {showCreateRegistration && (
                <CreateRegistrationForm
                  onCreate={handleCreateRegistration}
                  onCancel={() => setShowCreateRegistration(false)}
                  events={events.filter(e => !registrations.some(r => r.event.id === e.id))}
                  groups={groups}
                />
              )}

              {/* Список регистраций */}
              {filteredRegistrations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                  {searchQuery
                    ? "Подходящих регистраций не найдено"
                    : "Регистрации не найдены. Создайте первую регистрацию."
                  }
                </div>
              ) : (
                filteredRegistrations.map((reg) => (
                  <RegistrationCard
                    key={reg.id}
                    registration={reg}
                    mode={editingRegistrationId === reg.id ? 'edit' : 'view'}
                    onStartEdit={() => setEditingRegistrationId(reg.id)}
                    onDelete={() => handleDeleteRegistration(reg.id)}
                    onSave={(data) => handleUpdateRegistration(reg.id, data)}
                    onCancel={() => setEditingRegistrationId(null)}
                    groups={groups}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
          {/* Кнопка добавления волны */}
          <div className="flex justify-start">
            <button
                  onClick={() => setShowCreateWave(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <IconPlus size={16} />
              Добавить волну
            </button>
          </div>

              {/* Форма создания волны */}
              {showCreateWave && (
                <CreateWaveForm 
                  onCreate={handleCreateWave}
                  onCancel={() => setShowCreateWave(false)}
                  registrations={registrations}
                />
              )}

              {/* Список волн */}
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
                    mode={editingWaveId === w.id ? 'edit' : 'view'}
                    onStartEdit={() => setEditingWaveId(w.id)}
                    onDelete={() => handleDeleteWave(w.id)}
                    onSave={(data) => handleUpdateWave(w.id, data)}
                    onCancel={() => setEditingWaveId(null)}
                    registrations={registrations}
                  />
                ))
              )}
            </div>
          )}
        </>
          )}
    </div>
  );
};

export default EventRegistrationPage;

import { useState, useMemo, useRef, useEffect } from 'react';
import type { EventRegistration } from '../../api/eventRegistration';
import { useAdminData } from '../../contexts/AdminDataContext';
import { useEventumSlug } from '../../hooks/useEventumSlug';
import { groupsApi, eventsApi } from '../../api/eventumApi';
import {
  allocateWave,
  type WaveAllocationResult,
  type EventAssignment,
} from '../../utils/allocationAlgorithm';
import {
  IconX,
  IconPlus,
  IconCheck,
  IconUser,
  IconChevronDown,
  IconChevronRight,
} from '../icons';
import type { Participant } from '../../types';

// ─── Компонент поиска участника для добавления ──────────────────────

interface AddParticipantComboboxProps {
  availableParticipants: Participant[];
  onSelect: (participantId: number) => void;
}

const AddParticipantCombobox: React.FC<AddParticipantComboboxProps> = ({
  availableParticipants,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      availableParticipants.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase())
      ),
    [availableParticipants, query]
  );

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const el = listRef.current.children[highlighted] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlighted]);

  const handleSelect = (pid: number) => {
    onSelect(pid);
    setQuery('');
    setIsOpen(false);
    setHighlighted(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((p) => (p < filtered.length - 1 ? p + 1 : p));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((p) => (p > 0 ? p - 1 : -1));
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      handleSelect(filtered[highlighted].id);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  if (availableParticipants.length === 0) {
    return (
      <div className="mt-2 flex items-center gap-1 text-xs text-gray-400 italic">
        <IconPlus size={14} />
        <span>Все подавшие заявку уже распределены</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative mt-2">
      <div className="flex items-center gap-1">
        <IconPlus size={14} className="text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlighted(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Добавить участника..."
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
        />
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">Не найдено</div>
          ) : (
            <div ref={listRef} className="py-1">
              {filtered.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p.id)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 ${
                    i === highlighted ? 'bg-blue-50' : 'text-gray-700'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Карточка мероприятия в результате распределения ─────────────────

interface EventAllocationCardProps {
  assignment: EventAssignment;
  participantById: Map<number, Participant>;
  assignedInWave: Set<number>;
  /** pid → название мероприятия, в которое участник распределён */
  participantEventMap: Map<number, string>;
  onRemoveParticipant: (participantId: number) => void;
  onAddParticipant: (participantId: number) => void;
}

const EventAllocationCard: React.FC<EventAllocationCardProps> = ({
  assignment,
  participantById,
  assignedInWave,
  participantEventMap,
  onRemoveParticipant,
  onAddParticipant,
}) => {
  const [showApplicants, setShowApplicants] = useState(false);

  const { assignedIds, applicantIds, maxCapacity, eventName } = assignment;
  const assignedHere = useMemo(() => new Set(assignedIds), [assignedIds]);

  const overCapacity =
    maxCapacity !== null && assignedIds.length > maxCapacity;

  const availableToAdd = useMemo(
    () =>
      applicantIds
        .filter((pid) => !assignedInWave.has(pid))
        .map((pid) => participantById.get(pid))
        .filter((p): p is Participant => p != null),
    [applicantIds, assignedInWave, participantById]
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Шапка */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h5 className="text-sm font-semibold text-gray-900">{eventName}</h5>
        <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
          <span>
            Мест:{' '}
            <span className="font-medium text-gray-700">
              {maxCapacity ?? '∞'}
            </span>
          </span>
          <span>
            Заявок:{' '}
            <span className="font-medium text-gray-700">
              {applicantIds.length}
            </span>
          </span>
          <span>
            Распределено:{' '}
            <span
              className={`font-medium ${
                overCapacity ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {assignedIds.length}
            </span>
          </span>
        </div>
      </div>

      {overCapacity && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
          Превышена вместимость на {assignedIds.length - maxCapacity!}
        </div>
      )}

      {/* Распределённые участники */}
      <div className="mt-3 space-y-1">
        {assignedIds.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Нет распределённых участников</p>
        ) : (
          assignedIds.map((pid) => {
            const p = participantById.get(pid);
            return (
              <div
                key={pid}
                className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <IconUser size={14} className="text-emerald-500" />
                  <span className="text-sm text-gray-900">
                    {p?.name ?? `#${pid}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveParticipant(pid)}
                  className="rounded-full p-0.5 text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                  title="Убрать из распределения"
                >
                  <IconX size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Добавить участника */}
      <AddParticipantCombobox
        availableParticipants={availableToAdd}
        onSelect={onAddParticipant}
      />

      {/* Все заявки (сворачиваемый блок) */}
      <button
        type="button"
        onClick={() => setShowApplicants(!showApplicants)}
        className="mt-3 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        {showApplicants ? (
          <IconChevronDown size={14} />
        ) : (
          <IconChevronRight size={14} />
        )}
        Все заявки ({applicantIds.length})
      </button>

      {showApplicants && (
        <div className="mt-1.5 space-y-0.5 max-h-48 overflow-y-auto">
          {applicantIds.map((pid) => {
            const p = participantById.get(pid);
            const here = assignedHere.has(pid);
            const elsewhere = !here && assignedInWave.has(pid);
            const otherEvent = elsewhere ? participantEventMap.get(pid) : null;
            return (
              <div
                key={pid}
                className={`flex items-center gap-2 rounded px-2.5 py-1 text-sm ${
                  here
                    ? 'bg-emerald-50 text-emerald-700'
                    : elsewhere
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-gray-50 text-gray-600'
                }`}
              >
                <IconUser size={12} className="shrink-0" />
                <span>{p?.name ?? `#${pid}`}</span>
                {here && (
                  <span className="ml-auto text-xs text-emerald-500">распределён сюда</span>
                )}
                {elsewhere && (
                  <span className="ml-auto text-xs text-blue-400 truncate max-w-[50%]" title={otherEvent ?? undefined}>
                    → {otherEvent}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Секция волны ───────────────────────────────────────────────────

interface WaveSectionProps {
  result: WaveAllocationResult;
  waveIndex: number;
  participantById: Map<number, Participant>;
  onRemoveParticipant: (waveIndex: number, eventIndex: number, pid: number) => void;
  onAddParticipant: (waveIndex: number, eventIndex: number, pid: number) => void;
}

const WaveSection: React.FC<WaveSectionProps> = ({
  result,
  waveIndex,
  participantById,
  onRemoveParticipant,
  onAddParticipant,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const totalApplicants = new Set(
    result.events.flatMap((e) => e.applicantIds)
  ).size;
  const totalAssigned = new Set(
    result.events.flatMap((e) => e.assignedIds)
  ).size;

  const assignedInWave = useMemo(
    () => new Set(result.events.flatMap((e) => e.assignedIds)),
    [result.events]
  );

  const participantEventMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const ev of result.events) {
      for (const pid of ev.assignedIds) {
        m.set(pid, ev.eventName);
      }
    }
    return m;
  }, [result.events]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4 sm:p-5">
      {/* Заголовок волны */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-gray-500 transition-transform ${
              isCollapsed ? '' : 'rotate-90'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 0 1-1.06-1.06L10.19 9.9 6.15 5.85A.75.75 0 1 1 7.2 4.8l4.75 4.75a.75.75 0 0 1 0 1.06l-4.75 4.75z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <h4 className="text-base font-semibold text-gray-900">
            {result.waveName}
          </h4>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Мероприятий: {result.events.length}</span>
          <span>
            Распределено:{' '}
            <span className="font-semibold text-emerald-600">
              {totalAssigned}
            </span>{' '}
            / {totalApplicants}
          </span>
        </div>
      </button>

      {!isCollapsed && (
        <div className="mt-4 space-y-3">
          {result.events.map((assignment, eventIdx) => (
            <EventAllocationCard
              key={assignment.registrationId}
              assignment={assignment}
              participantById={participantById}
              assignedInWave={assignedInWave}
              participantEventMap={participantEventMap}
              onRemoveParticipant={(pid) =>
                onRemoveParticipant(waveIndex, eventIdx, pid)
              }
              onAddParticipant={(pid) =>
                onAddParticipant(waveIndex, eventIdx, pid)
              }
            />
          ))}

          {/* Нераспределённые */}
          {result.unassignedIds.length > 0 && (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4">
              <h5 className="text-sm font-semibold text-amber-800">
                Не распределены ({result.unassignedIds.length})
              </h5>
              <div className="mt-2 space-y-0.5 max-h-40 overflow-y-auto">
                {result.unassignedIds.map((pid) => {
                  const p = participantById.get(pid);
                  return (
                    <div
                      key={pid}
                      className="flex items-center gap-2 rounded px-2.5 py-1 text-sm text-amber-700"
                    >
                      <IconUser size={12} className="shrink-0" />
                      <span>{p?.name ?? `#${pid}`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Основной компонент вкладки ─────────────────────────────────────

const AllocationTab: React.FC = () => {
  const eventumSlug = useEventumSlug();
  const {
    eventWaves: waves,
    participants,
    events,
    refetch,
  } = useAdminData();

  const [allocationResults, setAllocationResults] = useState<
    WaveAllocationResult[] | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const participantById = useMemo(() => {
    const m = new Map<number, Participant>();
    for (const p of participants) m.set(p.id, p);
    return m;
  }, [participants]);

  // ── Запуск распределения ─────────────────────────────────────────

  const runAllocation = () => {
    const results: WaveAllocationResult[] = [];

    for (const wave of waves) {
      const waveRegs = (wave.registrations as EventRegistration[]).filter(
        (r) => r.registration_type === 'application'
      );
      if (waveRegs.length === 0) continue;

      const input = {
        registrations: waveRegs.map((r) => ({
          registrationId: r.id,
          eventId: r.event.id,
          eventName: r.event.name,
          maxCapacity: r.max_participants,
          applicantIds: r.applicants ?? [],
        })),
      };

      results.push(allocateWave(wave.id, wave.name, input));
    }

    setAllocationResults(results);
    setSaveStatus(null);
  };

  // ── Редактирование: удалить / добавить участника ─────────────────

  const handleRemoveParticipant = (
    waveIdx: number,
    eventIdx: number,
    participantId: number
  ) => {
    setAllocationResults((prev) => {
      if (!prev) return prev;
      const next = prev.map((w, wi) => {
        if (wi !== waveIdx) return w;
        const evts = w.events.map((ev, ei) => {
          if (ei !== eventIdx) return ev;
          return {
            ...ev,
            assignedIds: ev.assignedIds.filter((id) => id !== participantId),
          };
        });
        return {
          ...w,
          events: evts,
          unassignedIds: [...w.unassignedIds, participantId],
        };
      });
      return next;
    });
    setSaveStatus(null);
  };

  const handleAddParticipant = (
    waveIdx: number,
    eventIdx: number,
    participantId: number
  ) => {
    setAllocationResults((prev) => {
      if (!prev) return prev;
      const next = prev.map((w, wi) => {
        if (wi !== waveIdx) return w;
        const evts = w.events.map((ev, ei) => {
          if (ei !== eventIdx) return ev;
          return {
            ...ev,
            assignedIds: [...ev.assignedIds, participantId],
          };
        });
        return {
          ...w,
          events: evts,
          unassignedIds: w.unassignedIds.filter((id) => id !== participantId),
        };
      });
      return next;
    });
    setSaveStatus(null);
  };

  // ── Сохранение ───────────────────────────────────────────────────

  const handleSave = async () => {
    if (!allocationResults || !eventumSlug) return;

    setIsSaving(true);
    setSaveStatus(null);

    const tasks: Array<{ eventName: string; run: () => Promise<void> }> = [];

    for (const wave of allocationResults) {
      for (const assignment of wave.events) {
        if (assignment.assignedIds.length === 0) continue;

        const event = events.find((e) => e.id === assignment.eventId);
        if (!event) continue;

        const participantRelations = assignment.assignedIds.map((pid) => ({
          participant_id: pid,
          relation_type: 'inclusive' as const,
        }));

        tasks.push({
          eventName: assignment.eventName,
          run: async () => {
            if (event.event_group_id) {
              await groupsApi.update(
                event.event_group_id,
                { participant_relations: participantRelations },
                eventumSlug
              );
            } else {
              const created = await groupsApi.create(
                {
                  name: `Группа: ${event.name}`,
                  is_event_group: true,
                  participant_relations: participantRelations,
                },
                eventumSlug
              );
              const newGroup = (created as any).data ?? created;
              await eventsApi.patch(
                event.id,
                { event_group_id_write: newGroup.id },
                eventumSlug
              );
            }
          },
        });
      }
    }

    const results = await Promise.allSettled(tasks.map((t) => t.run()));

    const errors: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push(`${tasks[i].eventName}: ${msg}`);
      }
    });

    await refetch(['groups', 'participants', 'events', 'registrations', 'waves']);

    if (errors.length > 0) {
      setSaveStatus({
        type: 'error',
        message: errors.join('\n'),
      });
    } else {
      setSaveStatus({ type: 'success', message: 'Распределение сохранено!' });
    }

    setIsSaving(false);
  };

  // ── Проверка: есть ли волны с application-регистрациями ──────────

  const hasApplicationWaves = useMemo(
    () =>
      waves.some((w) =>
        (w.registrations as EventRegistration[]).some(
          (r) => r.registration_type === 'application'
        )
      ),
    [waves]
  );

  // ── Рендер ───────────────────────────────────────────────────────

  if (!hasApplicationWaves) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
        Нет волн с регистрациями типа «По заявкам». Распределение доступно
        только для мероприятий с регистрацией по заявкам, объединённых в волны.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Кнопка запуска */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runAllocation}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M15.312 11.424a5.5 5.5 0 01-9.376 2.12l-.707.708a6.5 6.5 0 0011.476-3.203 .75.75 0 00-1.393.375zm-10.624-2.85a5.5 5.5 0 019.376-2.12l.707-.707a6.5 6.5 0 00-11.476 3.203.75.75 0 001.393-.375z"
              clipRule="evenodd"
            />
          </svg>
          {allocationResults ? 'Пересчитать распределение' : 'Запустить распределение'}
        </button>

      </div>

      {/* Результаты по волнам */}
      {allocationResults && (
        <>
          {allocationResults.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              Нет заявок для распределения
            </div>
          ) : (
            <div className="space-y-4">
              {allocationResults.map((result, waveIdx) => (
                <WaveSection
                  key={result.waveId}
                  result={result}
                  waveIndex={waveIdx}
                  participantById={participantById}
                  onRemoveParticipant={handleRemoveParticipant}
                  onAddParticipant={handleAddParticipant}
                />
              ))}
            </div>
          )}

          {/* Кнопка сохранения */}
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Сохранение...
                </>
              ) : (
                <>
                  <IconCheck size={16} />
                  Сохранить распределение
                </>
              )}
            </button>

            {saveStatus && (
              <div
                className={`text-sm ${
                  saveStatus.type === 'success'
                    ? 'text-emerald-600'
                    : 'text-red-600'
                }`}
              >
                {saveStatus.message.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AllocationTab;

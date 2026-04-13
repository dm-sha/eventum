import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { 
  ParticipantGroup, 
  Participant, 
  RelationType,
  CreateParticipantGroupData,
  UpdateParticipantGroupData
} from '../../types';
import { IconX, IconPencil, IconCheck, IconPlus, IconMinus } from '../icons';
import { useOptionalAdminData } from '../../contexts/AdminDataContext';

interface ParticipantRelation {
  participant_id: number;
  participant?: Participant;
  relation_type: RelationType;
}

interface GroupRelation {
  target_group_id: number;
  target_group?: { id: number; name: string };
  relation_type: RelationType;
}

interface ParticipantGroupEditorProps {
  group?: ParticipantGroup | null;
  /** Если задано, подставляется вместо списка из админ-контекста (например, тесты или нестандартный источник). */
  participants?: Participant[];
  availableGroups?: ParticipantGroup[];
  onSave: (data: CreateParticipantGroupData | UpdateParticipantGroupData) => Promise<void>;
  onCancel: () => void;
  isModal?: boolean;
  isSaving?: boolean;
  isUpdating?: boolean;
  nameOverride?: string;
  hideNameField?: boolean;
  /** Скрыть настройку «Видна участникам» (например, группа мероприятия всегда непубличная). */
  hideVisibleToParticipants?: boolean;
  /** Элементы справа от строки с названием (например, удаление группы). */
  nameRowExtra?: ReactNode;
  hideActions?: boolean;
  onChange?: (data: {
    name: string;
    visible_to_participants: boolean;
    description: string;
    participant_relations: { participant_id: number; relation_type: RelationType }[];
    group_relations: { target_group_id: number; relation_type: RelationType }[];
  }) => void;
}

const ParticipantGroupEditor: React.FC<ParticipantGroupEditorProps> = ({
  group,
  participants: participantsProp,
  availableGroups = [],
  onSave,
  onCancel,
  isModal = false,
  isSaving = false,
  isUpdating = false,
  nameOverride,
  hideNameField = false,
  hideVisibleToParticipants = false,
  nameRowExtra,
  hideActions = false,
  onChange
}) => {
  const admin = useOptionalAdminData();
  const allParticipants = participantsProp ?? admin?.participants ?? [];

  const [name, setName] = useState(nameOverride ?? group?.name ?? '');
  const [participantQuery, setParticipantQuery] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [participantRelations, setParticipantRelations] = useState<ParticipantRelation[]>([]);
  const [groupRelations, setGroupRelations] = useState<GroupRelation[]>([]);
  const [participantFocused, setParticipantFocused] = useState(false);
  const [groupFocused, setGroupFocused] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const nameEditRef = useRef<HTMLDivElement>(null);
  const [visibleToParticipants, setVisibleToParticipants] = useState(false);
  const [description, setDescription] = useState('');

  // Отдельный эффект для инициализации состояния группы
  // Используем useMemo для нормализации relations и сравнения только при реальных изменениях
  const normalizedGroupKey = useMemo(() => {
    if (!group) return null;
    // Создаем ключ для сравнения на основе ID группы и relations
    const participantKeys = (group.participant_relations || [])
      .map(r => `${r.participant_id || r.participant?.id || 0}-${r.relation_type}`)
      .sort()
      .join(',');
    const groupKeys = (group.group_relations || [])
      .map(r => `${r.target_group_id || r.target_group?.id || 0}-${r.relation_type}`)
      .sort()
      .join(',');
    return `${group.id}-${participantKeys}-${groupKeys}-${nameOverride || ''}-${group.visible_to_participants}-${group.description ?? ''}`;
  }, [
    group?.id,
    group?.participant_relations,
    group?.group_relations,
    group?.visible_to_participants,
    group?.description,
    nameOverride,
  ]);

  useEffect(() => {
    // Флаг для предотвращения вызова onChange при первой инициализации
    setIsInitializing(true);
    setIsEditingName(false);

    if (group || nameOverride !== undefined) {
      const nextName = nameOverride ?? group?.name ?? '';
      setName(nextName);
      setNameDraft(nextName);
      // Инициализируем связи участников
      // Если participant_id отсутствует, извлекаем его из participant
      const participantRels: ParticipantRelation[] = (group?.participant_relations || []).map(rel => ({
        participant_id: rel.participant_id || rel.participant?.id || 0,
        participant: rel.participant,
        relation_type: rel.relation_type
      })).filter(rel => rel.participant_id > 0); // Фильтруем некорректные данные
      setParticipantRelations(participantRels);
      
      // Инициализируем связи групп
      // Если target_group_id отсутствует, извлекаем его из target_group
      const groupRels: GroupRelation[] = (group?.group_relations || []).map(rel => ({
        target_group_id: rel.target_group_id || rel.target_group?.id || 0,
        target_group: rel.target_group,
        relation_type: rel.relation_type
      })).filter(rel => rel.target_group_id > 0); // Фильтруем некорректные данные
      setGroupRelations(groupRels);
      setVisibleToParticipants(
        hideVisibleToParticipants ? false : (group?.visible_to_participants ?? false)
      );
      setDescription(group?.description ?? '');

      // Если группа загружена и есть relations, даем больше времени на инициализацию
      const hasRelations = participantRels.length > 0 || groupRels.length > 0;
      const delay = hasRelations ? 200 : 100;
      
      setTimeout(() => {
        setIsInitializing(false);
      }, delay);
    } else {
      setNameDraft('');
      setVisibleToParticipants(false);
      setDescription('');
      // Если нет группы, сбрасываем флаг быстрее
      setTimeout(() => {
        setIsInitializing(false);
      }, 50);
    }
  }, [normalizedGroupKey, hideVisibleToParticipants]); // Используем нормализованный ключ для сравнения

  useEffect(() => {
    if (!group || hideNameField || !isEditingName) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || nameEditRef.current?.contains(target)) return;
      setNameDraft(name);
      setIsEditingName(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [group, hideNameField, isEditingName, name]);

  const participantSuggestions = (() => {
    const notAlreadyAdded = allParticipants.filter((p) => !participantRelations.some((rel) => rel.participant_id === p.id));
    if (participantQuery) {
      return notAlreadyAdded
        .filter((p) => p.name.toLowerCase().includes(participantQuery.toLowerCase()))
        .slice(0, 5);
    }
    return participantFocused ? notAlreadyAdded.slice(0, 5) : [];
  })();

  const groupSuggestions = (() => {
    const notAlreadyAdded = availableGroups.filter((g) => {
      const alreadyAdded = groupRelations.some((rel) => rel.target_group_id === g.id);
      const isCurrentGroup = group && g.id === group.id;
      return !alreadyAdded && !isCurrentGroup;
    });
    if (groupQuery) {
      return notAlreadyAdded
        .filter((g) => g.name.toLowerCase().includes(groupQuery.toLowerCase()))
        .slice(0, 5);
    }
    return groupFocused ? notAlreadyAdded.slice(0, 5) : [];
  })();

  const addParticipantRelation = (participant: Participant, relationType: RelationType = 'inclusive') => {
    if (!participantRelations.some((rel) => rel.participant_id === participant.id)) {
      setParticipantRelations([
        ...participantRelations,
        { participant_id: participant.id, participant, relation_type: relationType }
      ]);
    }
    setParticipantQuery('');
  };

  const removeParticipantRelation = (participantId: number) => {
    setParticipantRelations(participantRelations.filter((rel) => rel.participant_id !== participantId));
  };

  const updateParticipantRelationType = (participantId: number, relationType: RelationType) => {
    setParticipantRelations(
      participantRelations.map((rel) =>
        rel.participant_id === participantId ? { ...rel, relation_type: relationType } : rel
      )
    );
  };

  const addGroupRelation = (targetGroup: ParticipantGroup, relationType: RelationType = 'inclusive') => {
    if (!groupRelations.some((rel) => rel.target_group_id === targetGroup.id)) {
      setGroupRelations([
        ...groupRelations,
        {
          target_group_id: targetGroup.id,
          target_group: { id: targetGroup.id, name: targetGroup.name },
          relation_type: relationType
        }
      ]);
    }
    setGroupQuery('');
  };

  const removeGroupRelation = (groupId: number) => {
    setGroupRelations(groupRelations.filter((rel) => rel.target_group_id !== groupId));
  };

  const updateGroupRelationType = (groupId: number, relationType: RelationType) => {
    setGroupRelations(
      groupRelations.map((rel) =>
        rel.target_group_id === groupId ? { ...rel, relation_type: relationType } : rel
      )
    );
  };

  const commitNameDraft = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setName(trimmed);
    setIsEditingName(false);
  };

  const startEditName = () => {
    setNameDraft(name);
    setIsEditingName(true);
  };

  const handleSave = async () => {
    const effectiveName = (nameOverride ?? name).trim();
    if (!effectiveName) return;

    const data: CreateParticipantGroupData | UpdateParticipantGroupData = {
      name: effectiveName,
      visible_to_participants: hideVisibleToParticipants ? false : visibleToParticipants,
      description: description.trim(),
      participant_relations: participantRelations.map(rel => ({
        participant_id: rel.participant_id,
        relation_type: rel.relation_type
      })),
      group_relations: groupRelations.map(rel => ({
        target_group_id: rel.target_group_id,
        relation_type: rel.relation_type
      }))
    };

    await onSave(data);
  };

  // Сообщаем наверх об изменениях (для инлайнового режима в форме события)
  // НЕ вызываем onChange при первой инициализации, чтобы не перезаписать данные из пропсов
  useEffect(() => {
    if (!onChange || isInitializing) return;
    const effectiveName = (nameOverride ?? name).trim();
    onChange({
      name: effectiveName,
      visible_to_participants: hideVisibleToParticipants ? false : visibleToParticipants,
      description,
      participant_relations: participantRelations.map(r => ({ participant_id: r.participant_id, relation_type: r.relation_type })),
      group_relations: groupRelations.map(r => ({ target_group_id: r.target_group_id, relation_type: r.relation_type }))
    });
  }, [
    name,
    nameOverride,
    visibleToParticipants,
    description,
    participantRelations,
    groupRelations,
    onChange,
    isInitializing,
    hideVisibleToParticipants,
  ]);

  return (
    <div className={isModal ? '' : 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm'}>
      <div className="space-y-4">
        {/* Название группы */}
        {!hideNameField && group ? (
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              {isEditingName ? (
                <div ref={nameEditRef} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    autoFocus
                    disabled={isSaving || isUpdating}
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-lg font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50"
                    placeholder="Название группы"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitNameDraft();
                      if (e.key === 'Escape') {
                        setNameDraft(name);
                        setIsEditingName(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={commitNameDraft}
                    disabled={isSaving || isUpdating || !nameDraft.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    title="Применить название"
                  >
                    <IconCheck size={18} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEditName}
                  className="group flex w-full min-w-0 items-center gap-2 text-left"
                >
                  <h3 className="truncate text-lg font-semibold text-gray-900 group-hover:text-blue-700">
                    {(nameOverride ?? name).trim() || 'Без названия'}
                  </h3>
                  <IconPencil
                    size={16}
                    className="shrink-0 text-gray-400 opacity-0 transition group-hover:opacity-100"
                  />
                </button>
              )}
            </div>
            {nameRowExtra ? <div className="flex shrink-0 items-center">{nameRowExtra}</div> : null}
          </div>
        ) : null}
        {!hideNameField && !group ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название группы
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Введите название группы"
            />
          </div>
        ) : null}

        {!hideVisibleToParticipants ? (
          <div className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
            <input
              id="participant-group-visible"
              type="checkbox"
              checked={visibleToParticipants}
              onChange={(e) => setVisibleToParticipants(e.target.checked)}
              disabled={isSaving || isUpdating}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="participant-group-visible" className="text-sm text-gray-700 cursor-pointer select-none">
              <span className="font-medium text-gray-900">Видна участникам</span>
            </label>
          </div>
        ) : null}

        <div>
          <label htmlFor="participant-group-description" className="block text-sm font-medium text-gray-700 mb-1">
            Описание
          </label>
          <textarea
            id="participant-group-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSaving || isUpdating}
            rows={3}
            className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
          />
        </div>

        {/* Добавление участников */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Участники
          </label>
          <div className="relative">
            <input
              type="text"
              value={participantQuery}
              onChange={(e) => setParticipantQuery(e.target.value)}
              onFocus={() => setParticipantFocused(true)}
              onBlur={() => setParticipantFocused(false)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Поиск участника..."
            />
            {participantSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {participantSuggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addParticipantRelation(p, 'inclusive')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Список добавленных участников с типом связи */}
          {participantRelations.length > 0 && (
            <div className="mt-2 space-y-2">
              {participantRelations.map((rel) => {
                const participant = rel.participant || allParticipants.find(p => p.id === rel.participant_id);
                if (!participant) return null;
                
                return (
                  <div key={rel.participant_id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                      {participant.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() => updateParticipantRelationType(rel.participant_id, 'inclusive')}
                          title="Включение в группу — участник входит в состав этой группы"
                          className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                            rel.relation_type === 'inclusive'
                              ? 'bg-green-100 text-green-800 ring-2 ring-green-300'
                              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                          }`}
                        >
                          <IconPlus size={16} strokeWidth={2.25} />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateParticipantRelationType(rel.participant_id, 'exclusive')}
                          title="Исключение из группы — участник не входит в состав, даже если его добавили через другие правила"
                          className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                            rel.relation_type === 'exclusive'
                              ? 'bg-red-100 text-red-800 ring-2 ring-red-300'
                              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                          }`}
                        >
                          <IconMinus size={16} strokeWidth={2.25} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeParticipantRelation(rel.participant_id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                        title="Убрать из списка"
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Добавление групп */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Группы
          </label>
          <div className="relative">
            <input
              type="text"
              value={groupQuery}
              onChange={(e) => setGroupQuery(e.target.value)}
              onFocus={() => setGroupFocused(true)}
              onBlur={() => setGroupFocused(false)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Поиск группы..."
            />
            {groupSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {groupSuggestions.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addGroupRelation(g, 'inclusive')}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Список добавленных групп с типом связи */}
          {groupRelations.length > 0 && (
            <div className="mt-2 space-y-2">
              {groupRelations.map((rel) => {
                const targetGroup = rel.target_group || availableGroups.find(g => g.id === rel.target_group_id);
                if (!targetGroup) return null;
                
                return (
                  <div key={rel.target_group_id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                      {targetGroup.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() => updateGroupRelationType(rel.target_group_id, 'inclusive')}
                          title="Включение в группу — участники связанной группы входят в состав этой группы"
                          className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                            rel.relation_type === 'inclusive'
                              ? 'bg-green-100 text-green-800 ring-2 ring-green-300'
                              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                          }`}
                        >
                          <IconPlus size={16} strokeWidth={2.25} />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateGroupRelationType(rel.target_group_id, 'exclusive')}
                          title="Исключение из группы — участники связанной группы не входят в состав этой группы"
                          className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                            rel.relation_type === 'exclusive'
                              ? 'bg-red-100 text-red-800 ring-2 ring-red-300'
                              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                          }`}
                        >
                          <IconMinus size={16} strokeWidth={2.25} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeGroupRelation(rel.target_group_id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                        title="Убрать из списка"
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Кнопки действий (скрываем в инлайновом режиме) */}
        {!hideActions && (
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!((nameOverride ?? name).trim()) || isSaving || isUpdating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSaving || isUpdating 
                ? (group ? 'Сохранение...' : 'Создание...') 
                : (group ? 'Сохранить' : 'Создать')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantGroupEditor;


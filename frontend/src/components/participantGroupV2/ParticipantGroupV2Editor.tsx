import { useState, useEffect } from 'react';
import type { 
  ParticipantGroupV2, 
  Participant, 
  RelationType,
  CreateParticipantGroupV2Data,
  UpdateParticipantGroupV2Data
} from '../../types';
import { IconX } from '../icons';
import { getParticipantsForEventum } from '../../api';

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

interface ParticipantGroupV2EditorProps {
  group?: ParticipantGroupV2 | null;
  eventumSlug: string;
  availableGroups?: ParticipantGroupV2[];
  onSave: (data: CreateParticipantGroupV2Data | UpdateParticipantGroupV2Data) => Promise<void>;
  onCancel: () => void;
  isModal?: boolean;
  isSaving?: boolean;
  isUpdating?: boolean;
  nameOverride?: string;
  hideNameField?: boolean;
  hideActions?: boolean;
  onChange?: (data: {
    name: string;
    participant_relations: { participant_id: number; relation_type: RelationType }[];
    group_relations: { target_group_id: number; relation_type: RelationType }[];
  }) => void;
}

const ParticipantGroupV2Editor: React.FC<ParticipantGroupV2EditorProps> = ({
  group,
  eventumSlug,
  availableGroups = [],
  onSave,
  onCancel,
  isModal = false,
  isSaving = false,
  isUpdating = false,
  nameOverride,
  hideNameField = false,
  hideActions = false,
  onChange
}) => {
  const [name, setName] = useState(nameOverride ?? group?.name ?? '');
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [participantQuery, setParticipantQuery] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [participantRelations, setParticipantRelations] = useState<ParticipantRelation[]>([]);
  const [groupRelations, setGroupRelations] = useState<GroupRelation[]>([]);

  useEffect(() => {
    if (group || nameOverride !== undefined) {
      setName(nameOverride ?? group?.name ?? '');
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
    }

    // Загружаем всех участников
    const loadParticipants = async () => {
      try {
        const data = await getParticipantsForEventum(eventumSlug);
        setAllParticipants(data);
      } catch (error) {
        console.error('Ошибка загрузки участников:', error);
      }
    };
    loadParticipants();
  }, [group, eventumSlug, nameOverride]);

  const participantSuggestions = participantQuery
    ? allParticipants
        .filter((p) => {
          const matchesQuery = p.name.toLowerCase().includes(participantQuery.toLowerCase());
          const alreadyAdded = participantRelations.some((rel) => rel.participant_id === p.id);
          return matchesQuery && !alreadyAdded;
        })
        .slice(0, 5)
    : [];

  const groupSuggestions = groupQuery
    ? availableGroups
        .filter((g) => {
          const matchesQuery = g.name.toLowerCase().includes(groupQuery.toLowerCase());
          const alreadyAdded = groupRelations.some((rel) => rel.target_group_id === g.id);
          const isCurrentGroup = group && g.id === group.id;
          return matchesQuery && !alreadyAdded && !isCurrentGroup;
        })
        .slice(0, 5)
    : [];

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

  const addGroupRelation = (targetGroup: ParticipantGroupV2, relationType: RelationType = 'inclusive') => {
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

  const handleSave = async () => {
    const effectiveName = (nameOverride ?? name).trim();
    if (!effectiveName) return;

    const data: CreateParticipantGroupV2Data | UpdateParticipantGroupV2Data = {
      name: effectiveName,
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
  useEffect(() => {
    if (!onChange) return;
    const effectiveName = (nameOverride ?? name).trim();
    onChange({
      name: effectiveName,
      participant_relations: participantRelations.map(r => ({ participant_id: r.participant_id, relation_type: r.relation_type })),
      group_relations: groupRelations.map(r => ({ target_group_id: r.target_group_id, relation_type: r.relation_type }))
    });
  }, [name, nameOverride, participantRelations, groupRelations, onChange]);

  return (
    <div className={isModal ? '' : 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm'}>
      <div className="space-y-4">
        {/* Название группы */}
        {!hideNameField ? (
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Поиск участника..."
            />
            {participantSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {participantSuggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
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
                  <div key={rel.participant_id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm text-gray-700">{participant.name}</span>
                      <select
                        value={rel.relation_type}
                        onChange={(e) => updateParticipantRelationType(rel.participant_id, e.target.value as RelationType)}
                        className="text-xs rounded border border-gray-300 px-2 py-1 bg-white focus:border-blue-500 focus:outline-none"
                      >
                        <option value="inclusive">Включает</option>
                        <option value="exclusive">Исключает</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeParticipantRelation(rel.participant_id)}
                      className="ml-2 rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                    >
                      <IconX size={14} />
                    </button>
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Поиск группы..."
            />
            {groupSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {groupSuggestions.map((g) => (
                  <button
                    key={g.id}
                    type="button"
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
                  <div key={rel.target_group_id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm text-gray-700">{targetGroup.name}</span>
                      <select
                        value={rel.relation_type}
                        onChange={(e) => updateGroupRelationType(rel.target_group_id, e.target.value as RelationType)}
                        className="text-xs rounded border border-gray-300 px-2 py-1 bg-white focus:border-blue-500 focus:outline-none"
                      >
                        <option value="inclusive">Включает</option>
                        <option value="exclusive">Исключает</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGroupRelation(rel.target_group_id)}
                      className="ml-2 rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                    >
                      <IconX size={14} />
                    </button>
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

export default ParticipantGroupV2Editor;


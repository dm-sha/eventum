import { useEffect, useState } from 'react';
import { groupsV2Api } from '../../api/eventumApi';
import type { 
  ParticipantGroupV2, 
  Participant,
  CreateParticipantGroupV2Data,
  UpdateParticipantGroupV2Data
} from '../../types';
import { IconPencil, IconPlus, IconInformationCircle, IconTrash } from '../../components/icons';
import { useEventumSlug } from '../../hooks/useEventumSlug';
import ParticipantGroupV2Editor from '../../components/participantGroupV2/ParticipantGroupV2Editor';
import GroupsLoadingSkeleton from '../../components/admin/skeletons/GroupsLoadingSkeleton';

const AdminGroupsV2Page = () => {
  const eventumSlug = useEventumSlug();
  const [groups, setGroups] = useState<ParticipantGroupV2[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!eventumSlug) return;
    
    const loadData = async () => {
      setIsLoading(true);
      try {
        const groupsData = (await groupsV2Api.getAll(eventumSlug)).data;
        setGroups(groupsData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [eventumSlug]);

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(filter.toLowerCase())
  );

  // Подсчет участников в группе с учетом включений/исключений
  const getParticipantsCount = (group: ParticipantGroupV2, visitedGroups = new Set<number>()): number => {
    // Предотвращаем циклические ссылки
    if (visitedGroups.has(group.id)) {
      return 0;
    }
    visitedGroups.add(group.id);

    // Множество ID участников, включенных в группу
    const includedParticipants = new Set<number>();
    // Множество ID участников, исключенных из группы
    const excludedParticipants = new Set<number>();

    // Обрабатываем прямые связи с участниками
    for (const rel of group.participant_relations) {
      if (!rel.participant_id) continue;
      
      if (rel.relation_type === 'inclusive') {
        includedParticipants.add(rel.participant_id);
      } else if (rel.relation_type === 'exclusive') {
        excludedParticipants.add(rel.participant_id);
      }
    }

    // Обрабатываем связи с группами
    for (const rel of group.group_relations) {
      if (!rel.target_group_id) continue;
      
      // Находим целевую группу в списке всех групп
      const targetGroup = groups.find(g => g.id === rel.target_group_id);
      if (!targetGroup) continue;

      // Рекурсивно получаем участников целевой группы
      const targetGroupParticipants = getParticipantsIdsFromGroup(targetGroup, new Set(visitedGroups));
      
      if (rel.relation_type === 'inclusive') {
        // Добавляем всех участников из целевой группы
        targetGroupParticipants.forEach(id => includedParticipants.add(id));
      } else if (rel.relation_type === 'exclusive') {
        // Исключаем всех участников из целевой группы
        targetGroupParticipants.forEach(id => excludedParticipants.add(id));
      }
    }

    // Исключаем участников из списка включенных
    excludedParticipants.forEach(id => includedParticipants.delete(id));

    return includedParticipants.size;
  };

  // Вспомогательная функция для получения множества ID участников из группы
  const getParticipantsIdsFromGroup = (group: ParticipantGroupV2, visitedGroups = new Set<number>()): Set<number> => {
    // Предотвращаем циклические ссылки
    if (visitedGroups.has(group.id)) {
      return new Set();
    }
    visitedGroups.add(group.id);

    const participantIds = new Set<number>();
    const excludedIds = new Set<number>();

    // Обрабатываем прямые связи с участниками
    for (const rel of group.participant_relations) {
      if (!rel.participant_id) continue;
      
      if (rel.relation_type === 'inclusive') {
        participantIds.add(rel.participant_id);
      } else if (rel.relation_type === 'exclusive') {
        excludedIds.add(rel.participant_id);
      }
    }

    // Обрабатываем связи с группами
    for (const rel of group.group_relations) {
      if (!rel.target_group_id) continue;
      
      const targetGroup = groups.find(g => g.id === rel.target_group_id);
      if (!targetGroup) continue;

      const targetGroupParticipants = getParticipantsIdsFromGroup(targetGroup, new Set(visitedGroups));
      
      if (rel.relation_type === 'inclusive') {
        targetGroupParticipants.forEach(id => participantIds.add(id));
      } else if (rel.relation_type === 'exclusive') {
        targetGroupParticipants.forEach(id => excludedIds.add(id));
      }
    }

    // Исключаем участников
    excludedIds.forEach(id => participantIds.delete(id));

    return participantIds;
  };

  // Получить участников для отображения
  const getParticipantsForDisplay = (group: ParticipantGroupV2): Participant[] => {
    return group.participant_relations
      .filter(rel => rel.participant)
      .map(rel => rel.participant!)
      .filter((p, index, self) => index === self.findIndex((p2) => p2.id === p.id));
  };

  const handleCreateGroup = () => {
    setIsCreatingGroup(true);
    setExpandedGroups(prev => new Set([...prev, -1]));
  };

  const handleSaveCreate = async (data: CreateParticipantGroupV2Data | UpdateParticipantGroupV2Data) => {
    if (!eventumSlug) return;
    
    setIsSaving(true);
    try {
      const created = (await groupsV2Api.create(data as CreateParticipantGroupV2Data, eventumSlug)).data;
      setGroups([...groups, created]);
      setIsCreatingGroup(false);
    } catch (error) {
      console.error('Ошибка создания группы:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditGroup = (group: ParticipantGroupV2) => {
    setEditingGroup(group.id);
    setExpandedGroups(prev => new Set([...prev, group.id]));
  };

  const handleSaveUpdate = async (data: UpdateParticipantGroupV2Data) => {
    if (!eventumSlug || !editingGroup) return;
    
    setIsUpdating(true);
    try {
      const updated = (await groupsV2Api.update(editingGroup, data, eventumSlug)).data;
      setGroups(groups.map(g => g.id === editingGroup ? updated : g));
      setEditingGroup(null);
    } catch (error) {
      console.error('Ошибка обновления группы:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditingGroup(null);
    setIsCreatingGroup(false);
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту группу?')) return;
    if (!eventumSlug) return;
    
    try {
      await groupsV2Api.delete(groupId, eventumSlug);
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  const toggleGroupExpansion = (groupId: number) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };


  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-gray-900">Группы участников V2</h2>
          <div className="group relative">
            <IconInformationCircle size={20} className="text-gray-400 cursor-help" />
            <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-normal w-80 z-50">
              Новая модель групп участников с поддержкой рекурсивных связей между группами и гибкой системой включения/исключения участников.
            </div>
          </div>
        </div>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="text-xs text-gray-500">Всего групп: {filteredGroups.length}</span>
      </div>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Поиск группы"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />

      {isLoading ? (
        <GroupsLoadingSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" style={{ gridAutoRows: 'min-content', alignItems: 'start' }}>
          {/* Карточка для добавления новой группы */}
          {!isCreatingGroup ? (
            <div 
              onClick={handleCreateGroup}
              className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50 min-h-[160px]"
            >
              <div className="flex flex-col items-center gap-2">
                <IconPlus size={32} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Добавить группу</span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <ParticipantGroupV2Editor
                eventumSlug={eventumSlug || ''}
                availableGroups={groups}
                onSave={handleSaveCreate}
                onCancel={handleCancel}
                isSaving={isSaving}
              />
            </div>
          )}

          {filteredGroups.map((group) => {
            const isEditing = editingGroup === group.id;
            const groupParticipants = getParticipantsForDisplay(group);
            const isExpanded = expandedGroups.has(group.id);
            const showAllButton = groupParticipants.length > 3;
            const displayParticipants = isExpanded ? groupParticipants : groupParticipants.slice(0, 3);
            const participantsCount = getParticipantsCount(group);

            return (
              <div key={group.id} className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                {isEditing ? (
                  <ParticipantGroupV2Editor
                    group={group}
                    eventumSlug={eventumSlug || ''}
                    availableGroups={groups.filter(g => g.id !== group.id)}
                    onSave={handleSaveUpdate}
                    onCancel={handleCancel}
                    isUpdating={isUpdating}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                        <div className="mt-2 text-xs text-gray-500">
                          <div>Участников: {participantsCount}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleEditGroup(group)}
                        className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <IconPencil size={16} />
                      </button>
                    </div>

                    <div className="space-y-2">
                      {/* Список участников */}
                      {groupParticipants.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-500 mb-1">Участники:</div>
                          {displayParticipants.map((participant) => {
                            const relation = group.participant_relations.find(
                              rel => rel.participant_id === participant.id
                            );
                            const relationType = relation?.relation_type || 'inclusive';
                            const relationLabel = relationType === 'inclusive' ? '+' : '-';
                            
                            return (
                              <div key={participant.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-1 rounded ${
                                    relationType === 'inclusive' 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {relationLabel}
                                  </span>
                                  <span className="text-sm text-gray-700">{participant.name}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Список связей с группами */}
                      {group.group_relations.length > 0 && (
                        <div className="space-y-1 mt-2 pt-2 border-t border-gray-200">
                          <div className="text-xs font-medium text-gray-500 mb-1">Группы:</div>
                          {group.group_relations.map((rel) => (
                            <div key={rel.id} className="flex items-center gap-2">
                              <span className={`text-xs px-1 rounded ${
                                rel.relation_type === 'inclusive' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {rel.relation_type === 'inclusive' ? '+' : '-'}
                              </span>
                              <span className="text-sm text-gray-700">
                                {rel.target_group?.name || `Группа #${rel.target_group_id}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {showAllButton && (
                        <button
                          onClick={() => toggleGroupExpansion(group.id)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          {isExpanded ? 'Скрыть' : `Показать всех (${groupParticipants.length})`}
                        </button>
                      )}

                      {/* Кнопка удаления */}
                      <div className="pt-2 border-t border-gray-200 mt-2">
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                        >
                          <IconTrash size={14} />
                          Удалить
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && filteredGroups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
          Группы не найдены
        </div>
      )}
    </div>
  );
};

export default AdminGroupsV2Page;


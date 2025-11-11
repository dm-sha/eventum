import { useEffect, useState, useMemo } from "react";
import { useDelayedLoading } from "../../hooks/useDelayedLoading";
import { getParticipantsForEventum, createParticipant, updateParticipant, deleteParticipant } from "../../api/participant";
import { groupsApi } from "../../api/eventumApi";
import { IconUser, IconExternalLink, IconPencil, IconTrash, IconPlus, IconEye } from "../../components/icons";
import ParticipantModal from "../../components/participant/ParticipantModal";
import ParticipantsLoadingSkeleton from "../../components/participant/ParticipantsLoadingSkeleton";
import LazyImage from "../../components/LazyImage";
import type { Participant, ParticipantGroup } from "../../types";
import { useEventumSlug } from "../../hooks/useEventumSlug";
import { getEventumScopedPath } from "../../utils/eventumSlug";

const AdminParticipantsPage = () => {
  const eventumSlug = useEventumSlug();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groups, setGroups] = useState<ParticipantGroup[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState<number | "">("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingParticipantId, setDeletingParticipantId] = useState<number | null>(null);
  
  const showLoading = useDelayedLoading(isLoading, 300);

  // Рекурсивно находим все группы, которые включают данную группу (через group_relations)
  // Исключаем группы с is_event_group=true
  const getGroupsThatInclude = useMemo(() => {
    const groupsMap = new Map<number, ParticipantGroup>();
    // Фильтруем только не-event группы
    const nonEventGroups = groups.filter(group => !group.is_event_group);
    nonEventGroups.forEach(group => {
      groupsMap.set(group.id, group);
    });

    const result = new Map<number, Set<number>>(); // groupId -> Set of groups that include it

    const findIncludingGroups = (groupId: number, visited = new Set<number>()): Set<number> => {
      if (visited.has(groupId)) {
        return result.get(groupId) || new Set();
      }
      visited.add(groupId);

      const includingGroups = new Set<number>();
      const group = groupsMap.get(groupId);
      if (!group) return includingGroups;

      // Ищем все группы, которые включают эту группу через inclusive group_relations
      // Учитываем только не-event группы
      nonEventGroups.forEach(otherGroup => {
        // Пропускаем event_group
        if (otherGroup.is_event_group) return;
        
        otherGroup.group_relations.forEach(rel => {
          if (rel.relation_type === 'inclusive' && 
              (rel.target_group_id === groupId || rel.target_group?.id === groupId)) {
            includingGroups.add(otherGroup.id);
            // Рекурсивно находим группы, которые включают эту группу
            const nestedIncluding = findIncludingGroups(otherGroup.id, new Set(visited));
            nestedIncluding.forEach(id => includingGroups.add(id));
          }
        });
      });

      result.set(groupId, includingGroups);
      return includingGroups;
    };

    // Предварительно вычисляем для всех не-event групп
    nonEventGroups.forEach(group => {
      findIncludingGroups(group.id);
    });

    return result;
  }, [groups]);

  // Вычисляем группы для каждого участника на основе групп (с учетом вложенных групп)
  // Исключаем группы с is_event_group=true
  const participantGroupsMap = useMemo(() => {
    const map = new Map<number, ParticipantGroup[]>();
    const groupsMap = new Map<number, ParticipantGroup>();
    // Фильтруем только не-event группы
    const nonEventGroups = groups.filter(group => !group.is_event_group);
    nonEventGroups.forEach(group => {
      groupsMap.set(group.id, group);
    });

    // Обрабатываем только не-event группы
    nonEventGroups.forEach(group => {
      group.participant_relations.forEach(rel => {
        if (rel.relation_type === 'inclusive') {
          const participantId = rel.participant_id || rel.participant?.id;
          if (participantId) {
            if (!map.has(participantId)) {
              map.set(participantId, []);
            }
            // Добавляем прямую группу (уже не-event, так как мы фильтруем)
            if (!map.get(participantId)!.some(g => g.id === group.id)) {
              map.get(participantId)!.push(group);
            }
            
            // Добавляем все группы, которые включают эту группу
            const includingGroups = getGroupsThatInclude.get(group.id);
            if (includingGroups) {
              includingGroups.forEach(includingGroupId => {
                const includingGroup = groupsMap.get(includingGroupId);
                // Дополнительная проверка на is_event_group (на всякий случай)
                if (includingGroup && !includingGroup.is_event_group && 
                    !map.get(participantId)!.some(g => g.id === includingGroup.id)) {
                  map.get(participantId)!.push(includingGroup);
                }
              });
            }
          }
        }
      });
    });
    return map;
  }, [groups, getGroupsThatInclude]);

  useEffect(() => {
    if (eventumSlug) {
      loadData();
    }
  }, [eventumSlug]);

  const loadData = async () => {
    if (!eventumSlug) return;
    
    setIsLoading(true);
    try {
      const [participantsData, groupsResponse] = await Promise.all([
        getParticipantsForEventum(eventumSlug),
        groupsApi.getAll(eventumSlug, { includeEventGroups: true }),
      ]);
      setParticipants(participantsData);
      setGroups(groupsResponse.data);
    } catch (error) {
      console.error("Ошибка при загрузке данных:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredParticipants = participants
    .filter((participant) => {
      const matchesName = participant.name.toLowerCase().includes(nameFilter.toLowerCase());
      
      const participantGroups = participantGroupsMap.get(participant.id) || [];
      
      if (groupFilter) {
        const matchesGroup = participantGroups.some(group => group.id === groupFilter);
        if (!matchesGroup) return false;
      }
      
      // Фильтр по тегам - в группах тегов нет напрямую, но можно оставить для обратной совместимости
      // если теги будут добавлены в группы в будущем
      
      return matchesName;
    })
    .reverse(); // Просто обращаем порядок от API

  const handleCreateParticipant = () => {
    setEditingParticipant(null);
    setIsModalOpen(true);
  };

  const handleEditParticipant = (participant: Participant) => {
    setEditingParticipant(participant);
    setIsModalOpen(true);
  };

  const handleSaveParticipant = async (data: { name: string; user_id?: number | null; removedGroupIds?: number[] }) => {
    if (!eventumSlug) return;

    setIsSaving(true);
    try {
      const { removedGroupIds, ...participantPayload } = data;
      if (editingParticipant) {
        await updateParticipant(eventumSlug, editingParticipant.id, participantPayload);
        if (removedGroupIds && removedGroupIds.length > 0) {
          const participantId = editingParticipant.id;
          await Promise.all(
            removedGroupIds.map(async (groupId) => {
              const group = groups.find((g) => g.id === groupId);
              // Пропускаем event_group и несуществующие группы
              if (!group || group.is_event_group) return;

              // Обновляем группу, удаляя связи с участником
              const updatedRelations = group.participant_relations
                .filter(rel => rel.participant_id !== participantId)
                .map(rel => ({
                  participant_id: rel.participant_id,
                  relation_type: rel.relation_type
                }));

              try {
                await groupsApi.update(groupId, {
                  participant_relations: updatedRelations
                }, eventumSlug);
              } catch (groupError) {
                console.error(`Ошибка при обновлении группы ${groupId}:`, groupError);
              }
            })
          );
        }
      } else {
        await createParticipant(eventumSlug, participantPayload);
      }
      await loadData();
    } catch (error) {
      console.error("Ошибка при сохранении участника:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteParticipant = async (participant: Participant) => {
    if (!eventumSlug || !confirm(`Удалить участника "${participant.name}"?`)) return;
    
    setDeletingParticipantId(participant.id);
    try {
      await deleteParticipant(eventumSlug, participant.id);
      await loadData();
    } catch (error) {
      console.error("Ошибка при удалении участника:", error);
    } finally {
      setDeletingParticipantId(null);
    }
  };

  const getVkUrl = (participant: Participant) => {
    if (participant.user?.vk_id) {
      return `https://vk.com/id${participant.user.vk_id}`;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-gray-900">Участники</h2>
        <p className="text-sm text-gray-500">
          Управляйте списком участников мероприятия.
        </p>
      </header>

      {/* Кнопка добавления */}
      <div className="flex justify-between items-center">
        <button
          onClick={handleCreateParticipant}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <IconPlus size={16} />
          Добавить участника
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-1">
          <input
            placeholder="Фильтр по имени"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value ? Number(e.target.value) : "")}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Все группы</option>
            {groups.filter(group => !group.is_event_group).map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

        </div>

          <span className="text-xs text-gray-500 whitespace-nowrap">Всего: {filteredParticipants.length}</span>
      </div>

      {/* Список участников */}
      {showLoading ? (
        <ParticipantsLoadingSkeleton />
      ) : (
        <ul className="space-y-3">
          {filteredParticipants.map((participant) => {
            const vkUrl = getVkUrl(participant);
            
            return (
              <li
                key={participant.id}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                {/* Аватарка или иконка участника слева */}
                {participant.user?.avatar_url ? (
                  <LazyImage
                    src={participant.user.avatar_url}
                    alt={participant.name}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    fallbackComponent={
                      <IconUser 
                        size={20} 
                        className="text-gray-400 flex-shrink-0"
                      />
                    }
                    onError={(e) => {
                      // Если аватарка не загрузилась, заменяем на иконку
                      const target = e.currentTarget as HTMLImageElement;
                      const nextElement = target.nextElementSibling as HTMLElement;
                      if (target) target.style.display = 'none';
                      if (nextElement) nextElement.style.display = 'block';
                    }}
                  />
                ) : (
                  <IconUser 
                    size={20} 
                    className="text-gray-400 flex-shrink-0"
                  />
                )}
                
                {/* Основная информация */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {participant.name}
                    </span>
                    {vkUrl && (
                      <a
                        href={vkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                      >
                        <IconExternalLink size={12} />
                        ВК
                      </a>
                    )}
                  </div>
                  
                  {/* Группы участника */}
                  {(() => {
                    const participantGroups = participantGroupsMap.get(participant.id) || [];
                    return participantGroups.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {participantGroups.map((group) => (
                          <span
                            key={group.id}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                          >
                            {group.name}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                
                {/* Кнопки действий справа */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={eventumSlug ? getEventumScopedPath(eventumSlug, `/general?participant=${participant.id}`) : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                    title="Просмотреть от лица участника"
                  >
                    <IconEye size={16} />
                  </a>
                  <button
                    onClick={() => handleEditParticipant(participant)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Редактировать"
                  >
                    <IconPencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteParticipant(participant)}
                    disabled={deletingParticipantId === participant.id}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Удалить"
                  >
                    {deletingParticipantId === participant.id ? (
                      <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
                    ) : (
                      <IconTrash size={16} />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
          
          {filteredParticipants.length === 0 && !showLoading && (
            <li className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              Подходящих участников не найдено
            </li>
          )}
        </ul>
      )}

      {/* Модальное окно */}
      <ParticipantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveParticipant}
        participant={editingParticipant}
        participantGroups={editingParticipant ? (participantGroupsMap.get(editingParticipant.id) || []) : []}
        isLoading={isSaving}
      />
    </div>
  );
};

export default AdminParticipantsPage;

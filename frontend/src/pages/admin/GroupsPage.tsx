import { useState, useMemo, useEffect } from 'react';
import { groupsApi } from '../../api/eventumApi';
import { useAdminData } from '../../contexts/AdminDataContext';
import {
  buildResolvedParticipantGroup,
  participantsToIdMap,
  type ParticipantGroupResolveOptions,
} from '../../utils/resolveParticipantGroup';
import type {
  Participant,
  ParticipantGroup,
  CreateParticipantGroupData,
  UpdateParticipantGroupData,
} from '../../types';
import {
  IconPencil,
  IconPlus,
  IconInformationCircle,
  IconTrash,
  IconUser,
} from '../../components/icons';
import { useEventumSlug } from '../../hooks/useEventumSlug';
import ParticipantGroupEditor from '../../components/participantGroup/ParticipantGroupEditor';
import ParticipantModal from '../../components/participant/ParticipantModal';
import GroupsLoadingSkeleton from '../../components/admin/skeletons/GroupsLoadingSkeleton';

const DIRECT_RELS_VISIBLE_LIMIT = 5;

const AdminGroupsPage = () => {
  const eventumSlug = useEventumSlug();
  const {
    groupsNonEvent,
    participantGroups,
    participants: allParticipants,
    isLoading,
    refetch,
  } = useAdminData();
  const groups = groupsNonEvent;

  const participantsById = useMemo(
    () => participantsToIdMap(allParticipants),
    [allParticipants]
  );

  const groupResolveOptions = useMemo<ParticipantGroupResolveOptions>(
    () => ({
      resolveGroup: (id) => participantGroups.find((g) => g.id === id) ?? null,
      allParticipantIds: new Set(allParticipants.map((p) => p.id)),
    }),
    [participantGroups, allParticipants]
  );
  const [filter, setFilter] = useState('');
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [fullMembersGroupId, setFullMembersGroupId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedDirectLists, setExpandedDirectLists] = useState<Record<string, boolean>>({});
  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);
  const [participantModalParticipant, setParticipantModalParticipant] =
    useState<Participant | null>(null);

  const directParticipantGroupsMap = useMemo(() => {
    const map = new Map<number, ParticipantGroup[]>();
    const nonEventGroups = participantGroups.filter((g) => !g.is_event_group);
    nonEventGroups.forEach((g) => {
      g.participant_relations.forEach((rel) => {
        if (rel.relation_type === 'inclusive') {
          const participantId = rel.participant_id || rel.participant?.id;
          if (participantId) {
            if (!map.has(participantId)) map.set(participantId, []);
            const list = map.get(participantId)!;
            if (!list.some((x) => x.id === g.id)) list.push(g);
          }
        }
      });
    });
    return map;
  }, [participantGroups]);

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    if (fullMembersGroupId != null && !groups.some((g) => g.id === fullMembersGroupId)) {
      setFullMembersGroupId(null);
    }
  }, [fullMembersGroupId, groups]);

  const handleCreateGroup = () => {
    setIsCreatingGroup(true);
  };

  const handleSaveCreate = async (data: CreateParticipantGroupData | UpdateParticipantGroupData) => {
    if (!eventumSlug) return;
    
    setIsSaving(true);
    try {
      await groupsApi.create(data as CreateParticipantGroupData, eventumSlug);
      await refetch(["groups"]);
      setIsCreatingGroup(false);
    } catch (error) {
      console.error('Ошибка создания группы:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditGroup = (group: ParticipantGroup) => {
    setEditingGroup(group.id);
  };

  const handleSaveUpdate = async (data: UpdateParticipantGroupData) => {
    if (!eventumSlug || !editingGroup) return;
    
    setIsUpdating(true);
    try {
      await groupsApi.update(editingGroup, data, eventumSlug);
      await refetch(["groups"]);
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
      await groupsApi.delete(groupId, eventumSlug);
      await refetch(["groups"]);
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  const fullMembersGroup = fullMembersGroupId
    ? groups.find((g) => g.id === fullMembersGroupId) ?? null
    : null;
  const fullMembersResolved = fullMembersGroup
    ? buildResolvedParticipantGroup(fullMembersGroup, groupResolveOptions, participantsById)
    : null;

  const openParticipantModal = (p: Participant) => {
    setParticipantModalParticipant(p);
    setIsParticipantModalOpen(true);
  };

  const closeParticipantModal = () => {
    setIsParticipantModalOpen(false);
    setParticipantModalParticipant(null);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold text-gray-900">Группы участников</h2>
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
              <ParticipantGroupEditor
                availableGroups={groups}
                onSave={handleSaveCreate}
                onCancel={handleCancel}
                isSaving={isSaving}
              />
            </div>
          )}

          {filteredGroups.map((group) => {
            const isEditing = editingGroup === group.id;
            const resolved = buildResolvedParticipantGroup(
              group,
              groupResolveOptions,
              participantsById
            );
            const participantsCount = resolved.participantIds.length;
            const directParticipantRels = [...(group.participant_relations ?? [])].sort(
              (a, b) => a.id - b.id
            );
            const directGroupRels = [...(group.group_relations ?? [])].sort((a, b) => a.id - b.id);

            return (
              <div key={group.id} className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                {isEditing ? (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1"></div>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="rounded-lg p-1 text-red-400 hover:bg-red-100 hover:text-red-600"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                    <ParticipantGroupEditor
                      group={group}
                      availableGroups={groups.filter(g => g.id !== group.id)}
                      onSave={handleSaveUpdate}
                      onCancel={handleCancel}
                      isUpdating={isUpdating}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                        <div className="mt-2 text-sm">
                          {participantsCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => setFullMembersGroupId(group.id)}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-1 py-0.5 -mx-1 text-gray-700 transition hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                              aria-label={`Список участников группы, ${participantsCount}`}
                            >
                              <IconUser
                                size={18}
                                className="shrink-0 opacity-80"
                                aria-hidden
                              />
                              <span className="font-semibold tabular-nums">{participantsCount}</span>
                            </button>
                          ) : (
                            <span
                              className="inline-flex shrink-0 items-center gap-1.5 text-gray-600"
                              aria-label={`Участников в группе: ${participantsCount}`}
                            >
                              <IconUser size={18} className="shrink-0 text-gray-400" aria-hidden />
                              <span className="font-semibold tabular-nums text-gray-900">
                                {participantsCount}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleEditGroup(group)}
                        className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <IconPencil size={16} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {directParticipantRels.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-600">Участники</div>
                          {(expandedDirectLists[`${group.id}-p`]
                            ? directParticipantRels
                            : directParticipantRels.slice(0, DIRECT_RELS_VISIBLE_LIMIT)
                          ).map((rel) => {
                            const p: Participant | undefined =
                              participantsById.get(rel.participant_id) ?? rel.participant;
                            const name =
                              p?.name ?? `Участник #${rel.participant_id}`;
                            const relationType = rel.relation_type;
                            const fullParticipant =
                              participantsById.get(rel.participant_id) ??
                              (p?.id === rel.participant_id ? p : undefined);
                            return (
                              <div key={rel.id} className="flex items-center gap-2">
                                <span
                                  className={`text-xs px-1 rounded ${
                                    relationType === "inclusive"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {relationType === "inclusive" ? "+" : "-"}
                                </span>
                                {fullParticipant ? (
                                  <button
                                    type="button"
                                    onClick={() => openParticipantModal(fullParticipant)}
                                    className="min-w-0 truncate text-left text-sm text-gray-700 underline-offset-2 hover:text-blue-700 hover:underline"
                                  >
                                    {name}
                                  </button>
                                ) : (
                                  <span className="min-w-0 truncate text-sm text-gray-700">
                                    {name}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {directParticipantRels.length > DIRECT_RELS_VISIBLE_LIMIT ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedDirectLists((prev) => ({
                                  ...prev,
                                  [`${group.id}-p`]: !prev[`${group.id}-p`],
                                }))
                              }
                              className="mt-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                            >
                              {expandedDirectLists[`${group.id}-p`]
                                ? 'Свернуть'
                                : `Показать все (${directParticipantRels.length})`}
                            </button>
                          ) : null}
                        </div>
                      )}

                      {directGroupRels.length > 0 && (
                        <div
                          className={`space-y-1 ${directParticipantRels.length > 0 ? "pt-2 border-t border-gray-100" : ""}`}
                        >
                          <div className="text-xs font-medium text-gray-600">Группы</div>
                          {(expandedDirectLists[`${group.id}-g`]
                            ? directGroupRels
                            : directGroupRels.slice(0, DIRECT_RELS_VISIBLE_LIMIT)
                          ).map((rel) => (
                            <div key={rel.id} className="flex items-center gap-2">
                              <span
                                className={`text-xs px-1 rounded ${
                                  rel.relation_type === "inclusive"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {rel.relation_type === "inclusive" ? "+" : "-"}
                              </span>
                              <span className="text-sm text-gray-700">
                                {rel.target_group?.name || `Группа #${rel.target_group_id}`}
                              </span>
                            </div>
                          ))}
                          {directGroupRels.length > DIRECT_RELS_VISIBLE_LIMIT ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedDirectLists((prev) => ({
                                  ...prev,
                                  [`${group.id}-g`]: !prev[`${group.id}-g`],
                                }))
                              }
                              className="mt-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                            >
                              {expandedDirectLists[`${group.id}-g`]
                                ? 'Свернуть'
                                : `Показать все (${directGroupRels.length})`}
                            </button>
                          ) : null}
                        </div>
                      )}
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

      {fullMembersResolved && fullMembersGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="full-members-title"
          onClick={() => setFullMembersGroupId(null)}
        >
          <div
            className="flex max-h-[min(80vh,560px)] w-full max-w-md flex-col rounded-xl bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <div className="min-w-0 pr-2">
                <h3
                  id="full-members-title"
                  className="text-base font-semibold text-gray-900 truncate"
                >
                  {fullMembersGroup.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFullMembersGroupId(null)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {fullMembersResolved.participants.map((p) => (
                <li
                  key={p.id}
                  className="border-b border-gray-50 py-2 text-sm last:border-0"
                >
                  <button
                    type="button"
                    onClick={() => openParticipantModal(p)}
                    className="w-full truncate text-left text-gray-800 underline-offset-2 hover:text-blue-700 hover:underline"
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <ParticipantModal
        isOpen={isParticipantModalOpen}
        onClose={closeParticipantModal}
        participant={participantModalParticipant}
        participantGroups={
          participantModalParticipant
            ? directParticipantGroupsMap.get(participantModalParticipant.id) ?? []
            : []
        }
        availableGroups={participantGroups}
        eventumSlug={eventumSlug ?? null}
        onAfterMutate={async () => {
          await refetch(['participants', 'groups']);
        }}
      />
    </div>
  );
};

export default AdminGroupsPage;


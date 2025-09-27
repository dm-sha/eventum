import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useDelayedLoading } from "../../hooks/useDelayedLoading";
import { getParticipantsForEventum, createParticipant, updateParticipant, deleteParticipant } from "../../api/participant";
import { getGroupsForEventum } from "../../api/group";
import { groupTagApi } from "../../api/groupTag";
import { IconUser, IconExternalLink, IconPencil, IconTrash, IconPlus } from "../../components/icons";
import ParticipantModal from "../../components/participant/ParticipantModal";
import ParticipantsLoadingSkeleton from "../../components/participant/ParticipantsLoadingSkeleton";
import type { Participant, ParticipantGroup, GroupTag } from "../../types";

const AdminParticipantsPage = () => {
  const { eventumSlug } = useParams();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groups, setGroups] = useState<ParticipantGroup[]>([]);
  const [groupTags, setGroupTags] = useState<GroupTag[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState<number | "">("");
  const [tagFilter, setTagFilter] = useState<number | "">("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingParticipantId, setDeletingParticipantId] = useState<number | null>(null);
  
  const showLoading = useDelayedLoading(isLoading, 300);

  useEffect(() => {
    if (eventumSlug) {
      loadData();
    }
  }, [eventumSlug]);

  const loadData = async () => {
    if (!eventumSlug) return;
    
    setIsLoading(true);
    try {
      const [participantsData, groupsData, tagsData] = await Promise.all([
        getParticipantsForEventum(eventumSlug),
        getGroupsForEventum(eventumSlug),
        groupTagApi.getGroupTags(eventumSlug)
      ]);
      setParticipants(participantsData);
      setGroups(groupsData);
      setGroupTags(tagsData);
    } catch (error) {
      console.error("Ошибка при загрузке данных:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredParticipants = participants
    .filter((participant) => {
      const matchesName = participant.name.toLowerCase().includes(nameFilter.toLowerCase());
      
      if (groupFilter && participant.groups) {
        const matchesGroup = participant.groups.some(group => group.id === groupFilter);
        if (!matchesGroup) return false;
      }
      
      if (tagFilter && participant.groups) {
        const matchesTag = participant.groups.some(group => 
          group.tags && group.tags.some(tag => tag.id === tagFilter)
        );
        if (!matchesTag) return false;
      }
      
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

  const handleSaveParticipant = async (data: { name: string }) => {
    if (!eventumSlug) return;
    
    setIsSaving(true);
    try {
      if (editingParticipant) {
        await updateParticipant(eventumSlug, editingParticipant.id, data);
      } else {
        await createParticipant(eventumSlug, data);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={handleCreateParticipant}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
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
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value ? Number(e.target.value) : "")}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">Все теги</option>
            {groupTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
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
                className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      {participant.user?.avatar_url ? (
                        <>
                          <img
                            src={participant.user.avatar_url}
                            alt={participant.name}
                            className="h-12 w-12 rounded-full object-cover"
                            onError={(e) => {
                              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                              if (fallback) {
                                fallback.classList.remove('hidden');
                              }
                              e.currentTarget.remove();
                            }}
                          />
                          <div className="avatar-fallback hidden flex h-full w-full items-center justify-center">
                            <IconUser size={20} />
                          </div>
                        </>
                      ) : (
                        <IconUser size={20} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-gray-900">
                          {participant.name}
                        </span>
                        {vkUrl && (
                          <a
                            href={vkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            <IconExternalLink size={12} /> VK
                          </a>
                        )}
                      </div>

                      {participant.groups && participant.groups.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {participant.groups.map((group) => (
                            <span
                              key={group.id}
                              className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                            >
                              {group.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleEditParticipant(participant)}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 p-2 text-gray-500 transition-colors hover:border-blue-500 hover:text-blue-600"
                      title="Редактировать"
                    >
                      <IconPencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteParticipant(participant)}
                      disabled={deletingParticipantId === participant.id}
                      className={`inline-flex items-center justify-center rounded-lg border p-2 text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        deletingParticipantId === participant.id
                          ? 'border-red-200 bg-red-50'
                          : 'border-red-100 hover:border-red-300 hover:bg-red-50'
                      }`}
                      title="Удалить"
                    >
                      {deletingParticipantId === participant.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
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
        isLoading={isSaving}
      />
    </div>
  );
};

export default AdminParticipantsPage;

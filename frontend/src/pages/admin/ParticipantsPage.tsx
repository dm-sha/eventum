import { useEffect, useState } from "react";
import { useDelayedLoading } from "../../hooks/useDelayedLoading";
import { getParticipantsForEventum, createParticipant, updateParticipant, deleteParticipant } from "../../api/participant";
import { getGroupsForEventum } from "../../api/group";
import { groupTagApi } from "../../api/groupTag";
import { IconUser, IconExternalLink, IconPencil, IconTrash, IconPlus } from "../../components/icons";
import ParticipantModal from "../../components/participant/ParticipantModal";
import ParticipantsLoadingSkeleton from "../../components/participant/ParticipantsLoadingSkeleton";
import type { Participant, ParticipantGroup, GroupTag } from "../../types";
import { useEventumSlug } from "../../hooks/useEventumSlug";

const AdminParticipantsPage = () => {
  const eventumSlug = useEventumSlug();
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

  const handleSaveParticipant = async (data: { name: string; user_id?: number | null }) => {
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
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                {/* Аватарка или иконка участника слева */}
                {participant.user?.avatar_url ? (
                  <img
                    src={participant.user.avatar_url}
                    alt={participant.name}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    onError={(e) => {
                      // Если аватарка не загрузилась, заменяем на иконку
                      const target = e.currentTarget as HTMLImageElement;
                      const nextElement = target.nextElementSibling as HTMLElement;
                      if (target) target.style.display = 'none';
                      if (nextElement) nextElement.style.display = 'block';
                    }}
                  />
                ) : null}
                <IconUser 
                  size={20} 
                  className={`text-gray-400 flex-shrink-0 ${participant.user?.avatar_url ? 'hidden' : ''}`}
                />
                
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
                  {participant.groups && participant.groups.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {participant.groups.map((group) => (
                        <span
                          key={group.id}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                        >
                          {group.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Кнопки действий справа */}
                <div className="flex items-center gap-2 flex-shrink-0">
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
        isLoading={isSaving}
      />
    </div>
  );
};

export default AdminParticipantsPage;

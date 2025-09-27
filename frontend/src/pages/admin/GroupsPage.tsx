import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getGroupsForEventum,
  createGroup,
  updateGroup,
  getParticipantsForEventum,
} from '../../api';
import type { ParticipantGroup, Participant } from '../../types';
import { IconPencil, IconX, IconPlus, IconInformationCircle } from '../../components/icons';

const AdminGroupsPage = () => {
  const { eventumSlug } = useParams();
  const [groups, setGroups] = useState<ParticipantGroup[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filter, setFilter] = useState('');
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [editingParticipants, setEditingParticipants] = useState<Participant[]>([]);

  const [groupName, setGroupName] = useState('');
  const [participantQuery, setParticipantQuery] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!eventumSlug) return;
    
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [groupsData, participantsData] = await Promise.all([
          getGroupsForEventum(eventumSlug),
          getParticipantsForEventum(eventumSlug)
        ]);
        setGroups(groupsData);
        setParticipants(participantsData);
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

  const suggestions = participantQuery
    ? participants
        .filter((p) => {
          const matchesQuery = p.name.toLowerCase().includes(participantQuery.toLowerCase());
          
          if (editingGroup || isCreatingGroup) {
            // В режиме редактирования или создания исключаем участников, которые уже в списке редактирования
            return matchesQuery && !editingParticipants.some((ep) => ep.id === p.id);
          } else {
            // При создании новой группы исключаем уже выбранных участников
            return matchesQuery && !selectedParticipants.some((sp) => sp.id === p.id);
          }
        })
        .slice(0, 5)
    : [];

  const addParticipant = (p: Participant) => {
    if (editingGroup || isCreatingGroup) {
      // Если мы в режиме редактирования или создания, добавляем участника во временный список
      setEditingParticipants(prev => {
        if (prev.some(ep => ep.id === p.id)) return prev;
        return [...prev, p];
      });
    } else {
      // Если создаем новую группу, добавляем в selectedParticipants
      setSelectedParticipants([...selectedParticipants, p]);
    }
    setParticipantQuery('');
  };

  const removeEditingParticipant = (id: number) => {
    setEditingParticipants(editingParticipants.filter((p) => p.id !== id));
  };

  const handleSave = async () => {
    if (!eventumSlug || !groupName.trim()) return;
    const data = {
      name: groupName,
      participants: editingParticipants.map((p) => p.id),
    };
    const created = await createGroup(eventumSlug, data);
    setGroups([...groups, created]);
    setIsCreatingGroup(false);
    setGroupName('');
    setEditingParticipants([]);
  };

  const handleCreateGroup = () => {
    setIsCreatingGroup(true);
    setGroupName('');
    setEditingParticipants([]);
    setExpandedGroups(prev => new Set([...prev, -1])); // -1 для карточки создания
  };

  const handleEditGroup = (group: ParticipantGroup) => {
    setEditingGroup(group.id);
    setGroupName(group.name);
    const groupParticipants = group.participants
      .map((id) => participants.find((p) => p.id === id))
      .filter(Boolean) as Participant[];
    setEditingParticipants(groupParticipants);
    setExpandedGroups(prev => new Set([...prev, group.id]));
  };

  const handleUpdateGroup = async (groupId: number) => {
    if (!eventumSlug || !groupName.trim()) return;
    const data = {
      name: groupName,
      participants: editingParticipants.map((p) => p.id),
    };
    const updated = await updateGroup(eventumSlug, groupId, data);
    setGroups(groups.map(g => g.id === groupId ? updated : g));
    setEditingGroup(null);
    setGroupName('');
    setEditingParticipants([]);
  };

  const handleCancel = () => {
    setEditingGroup(null);
    setIsCreatingGroup(false);
    setGroupName('');
    setEditingParticipants([]);
    setParticipantQuery('');
  };

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );


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
          <h2 className="text-2xl font-semibold text-gray-900">Группы участников</h2>
          <div className="group relative">
            <IconInformationCircle size={20} className="text-gray-400 cursor-help" />
            <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-normal w-80 z-50">
              Группы предназначены для удобного назначения участников на мероприятия, а также для их структурирования и категоризации.
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
        <LoadingSpinner />
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
              <div className="flex items-start justify-between mb-3">
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Название группы"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <div className="mb-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={participantQuery}
                      onChange={(e) => setParticipantQuery(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Добавить участника..."
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                        {suggestions.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => addParticipant(p)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  {editingParticipants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{participant.name}</span>
                      <button
                        onClick={() => removeEditingParticipant(participant.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={!groupName.trim()}
                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    Создать
                  </button>
                  <button
                    onClick={handleCancel}
                    className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredGroups.map((group) => {
          const isEditing = editingGroup === group.id;
          const groupParticipants = isEditing 
            ? editingParticipants 
            : group.participants
                .map((id) => participants.find((p) => p.id === id))
                .filter(Boolean) as Participant[];
          
          const isExpanded = expandedGroups.has(group.id);
          const showAllButton = groupParticipants.length > 3;
          const displayParticipants = isExpanded ? groupParticipants : groupParticipants.slice(0, 3);

          return (
            <div key={group.id} className="relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                {isEditing ? (
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                ) : (
                  <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                )}
                <button
                  onClick={() => handleEditGroup(group)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <IconPencil size={16} />
                </button>
              </div>

              <div className="space-y-2">
                {isEditing && (
                  <div className="mb-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={participantQuery}
                        onChange={(e) => setParticipantQuery(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Добавить участника..."
                      />
                      {suggestions.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                          {suggestions.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => addParticipant(p)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  {displayParticipants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{participant.name}</span>
                      {isEditing && (
                        <button
                          onClick={() => removeEditingParticipant(participant.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                        >
                          <IconX size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {showAllButton && (
                  <button
                    onClick={() => toggleGroupExpansion(group.id)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {isExpanded ? 'Скрыть' : `Показать всех (${groupParticipants.length})`}
                  </button>
                )}

                {isEditing && (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleUpdateGroup(group.id)}
                      className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={handleCancel}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Отмена
                    </button>
                  </div>
                )}
              </div>
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

export default AdminGroupsPage;

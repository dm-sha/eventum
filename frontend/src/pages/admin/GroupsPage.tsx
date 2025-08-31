import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getGroupsForEventum,
  createGroup,
  getParticipantsForEventum,
} from '../../api';
import type { ParticipantGroup, Participant } from '../../types';

const AdminGroupsPage = () => {
  const { eventumSlug } = useParams();
  const [groups, setGroups] = useState<ParticipantGroup[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [groupName, setGroupName] = useState('');
  const [participantQuery, setParticipantQuery] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!eventumSlug) return;
    getGroupsForEventum(eventumSlug).then(setGroups);
    getParticipantsForEventum(eventumSlug).then(setParticipants);
  }, [eventumSlug]);

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(filter.toLowerCase())
  );

  const suggestions = participantQuery
    ? participants
        .filter(
          (p) =>
            p.name.toLowerCase().includes(participantQuery.toLowerCase()) &&
            !selectedParticipants.some((sp) => sp.id === p.id)
        )
        .slice(0, 5)
    : [];

  const addParticipant = (p: Participant) => {
    setSelectedParticipants([...selectedParticipants, p]);
    setParticipantQuery('');
  };

  const removeParticipant = (id: number) => {
    setSelectedParticipants(selectedParticipants.filter((p) => p.id !== id));
  };

  const handleSave = async () => {
    if (!eventumSlug) return;
    const data = {
      name: groupName,
      participants: selectedParticipants.map((p) => p.id),
    };
    const created = await createGroup(eventumSlug, data);
    setGroups([...groups, created]);
    setShowForm(false);
    setGroupName('');
    setSelectedParticipants([]);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Группы участников</h2>
      <button
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded"
        onClick={() => setShowForm(true)}
      >
        Добавить
      </button>

      {showForm && (
        <div className="mb-6 border p-4 rounded bg-white">
          <div className="mb-4">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Название группы"
              className="w-full border border-gray-300 rounded px-2 py-1"
            />
          </div>

          <div className="mb-2 relative">
            <input
              value={participantQuery}
              onChange={(e) => setParticipantQuery(e.target.value)}
              placeholder="Добавить участника"
              className="w-full border border-gray-300 rounded px-2 py-1"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 bg-white border border-gray-200 w-full mt-1 max-h-40 overflow-y-auto">
                {suggestions.map((p) => (
                  <li
                    key={p.id}
                    className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                    onClick={() => addParticipant(p)}
                  >
                    {p.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {selectedParticipants.slice(0, 5).map((p) => (
              <span
                key={p.id}
                className="flex items-center bg-gray-200 px-2 py-1 rounded"
              >
                {p.name}
                <button
                  className="ml-1 text-gray-600"
                  onClick={() => removeParticipant(p.id)}
                >
                  ×
                </button>
              </span>
            ))}
            {selectedParticipants.length > 5 && (
              <span className="flex items-center bg-gray-200 px-2 py-1 rounded">
                Показать всех ({selectedParticipants.length})
              </span>
            )}
          </div>

          {/* TODO: выбор участников по тегам */}

          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-green-500 text-white rounded"
              onClick={handleSave}
            >
              Сохранить
            </button>
            <button
              className="px-4 py-2 bg-gray-300 rounded"
              onClick={() => setShowForm(false)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Поиск группы"
        className="mb-4 w-full border border-gray-300 rounded px-2 py-1"
      />

      <div className="space-y-4">
        {filteredGroups.map((g) => {
          const groupParticipants = g.participants
            .map((id) => participants.find((p) => p.id === id)?.name)
            .filter(Boolean) as string[];
          return (
            <div key={g.id} className="border p-4 rounded bg-white">
              <h3 className="font-semibold mb-2">{g.name}</h3>
              <div className="flex flex-wrap gap-2">
                {groupParticipants.slice(0, 5).map((name, idx) => (
                  <span key={idx} className="bg-gray-200 px-2 py-1 rounded">
                    {name}
                  </span>
                ))}
                {groupParticipants.length > 5 && (
                  <button className="bg-gray-200 px-2 py-1 rounded">
                    Показать всех
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminGroupsPage;

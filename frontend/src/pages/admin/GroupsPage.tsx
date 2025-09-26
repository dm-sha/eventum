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
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-gray-900">Группы участников</h2>
        <p className="text-sm text-gray-500">
          Создавайте группы, добавляйте участников и упрощайте массовую коммуникацию.
        </p>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={() => setShowForm(true)}
        >
          Добавить группу
        </button>
        <span className="text-xs text-gray-500">Всего групп: {filteredGroups.length}</span>
      </div>

      {showForm && (
        <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700" htmlFor="group-name">
              Название группы
            </label>
            <input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Введите название"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700" htmlFor="participant-search">
              Добавить участника
            </label>
            <div className="relative">
              <input
                id="participant-search"
                value={participantQuery}
                onChange={(e) => setParticipantQuery(e.target.value)}
                placeholder="Начните вводить имя"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {suggestions.length > 0 && (
                <ul className="absolute z-20 mt-2 max-h-48 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                  {suggestions.map((p) => (
                    <li
                      key={p.id}
                      className="cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => addParticipant(p)}
                    >
                      {p.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Выбранные участники</p>
            <div className="flex flex-wrap gap-2">
              {selectedParticipants.slice(0, 5).map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                >
                  {p.name}
                  <button
                    className="ml-2 text-blue-500 hover:text-blue-700"
                    onClick={() => removeParticipant(p.id)}
                    type="button"
                    aria-label={`Удалить ${p.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedParticipants.length > 5 && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  Показать всех ({selectedParticipants.length})
                </span>
              )}
            </div>
          </div>

          {/* TODO: выбор участников по тегам */}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              onClick={handleSave}
              type="button"
            >
              Сохранить
            </button>
            <button
              className="inline-flex items-center justify-center rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              onClick={() => setShowForm(false)}
              type="button"
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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />

      <div className="space-y-4">
        {filteredGroups.map((g) => {
          const groupParticipants = g.participants
            .map((id) => participants.find((p) => p.id === id)?.name)
            .filter(Boolean) as string[];
          return (
            <article key={g.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{g.name}</h3>
                <span className="text-xs text-gray-500">Участников: {groupParticipants.length}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {groupParticipants.slice(0, 5).map((name, idx) => (
                  <span key={idx} className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {name}
                  </span>
                ))}
                {groupParticipants.length > 5 && (
                  <button className="inline-flex items-center rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
                    Показать всех
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {filteredGroups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
            Группы не найдены
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminGroupsPage;

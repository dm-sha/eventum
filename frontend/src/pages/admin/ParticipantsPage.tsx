import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getParticipantsForEventum } from "../../api/participant";
import type { Participant } from "../../types";

const AdminParticipantsPage = () => {
  const { eventumSlug } = useParams();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [nameFilter, setNameFilter] = useState("");

  useEffect(() => {
    if (eventumSlug) {
      getParticipantsForEventum(eventumSlug).then(setParticipants);
    }
  }, [eventumSlug]);

  const filtered = participants.filter((p) =>
    p.name.toLowerCase().includes(nameFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-gray-900">Участники</h2>
        <p className="text-sm text-gray-500">
          Найдите участника по имени и управляйте списком участников группы.
        </p>
      </header>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          placeholder="Фильтр по имени"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-auto"
        />
        <span className="text-xs text-gray-500">Всего: {filtered.length}</span>
      </div>
      <ul className="space-y-3">
        {filtered.map((p) => (
          <li
            key={p.id}
            className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm font-medium text-gray-900">{p.name}</span>
            <span className="text-xs text-gray-500">ID: {p.id}</span>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
            Подходящих участников не найдено
          </li>
        )}
      </ul>
    </div>
  );
};

export default AdminParticipantsPage;

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getEventsForEventum } from "../../api/event";
import type { Event } from "../../types";

const AdminEventsPage = () => {
  const { eventumSlug } = useParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (eventumSlug) {
      getEventsForEventum(eventumSlug).then(setEvents);
    }
  }, [eventumSlug]);

  const filtered = events.filter(
    (e) =>
      e.name.toLowerCase().includes(nameFilter.toLowerCase()) &&
      (!tagFilter || e.tags.includes(Number(tagFilter)))
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    setEvents((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: newName,
        description: "",
        start_time: "",
        end_time: "",
        eventum: 0,
        participants: [],
        groups: [],
        tags: [],
      },
    ]);
    setNewName("");
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Мероприятия</h2>
      <div className="mb-4 flex gap-4 flex-wrap">
        <input
          placeholder="Фильтр по названию"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1"
        />
        <input
          placeholder="Фильтр по тегу"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1"
        />
      </div>
      <ul className="space-y-2 mb-8">
        {filtered.map((ev) => (
          <li
            key={ev.id}
            className="p-2 border border-gray-200 rounded bg-white"
          >
            {ev.name}
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd} className="space-y-2 max-w-md">
        <h3 className="font-medium">Добавить мероприятие</h3>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Название"
          className="w-full border border-gray-300 rounded px-3 py-2"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Добавить
        </button>
      </form>
    </div>
  );
};

export default AdminEventsPage;

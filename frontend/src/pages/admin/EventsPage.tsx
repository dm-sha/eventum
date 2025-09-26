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
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-gray-900">Мероприятия</h2>
        <p className="text-sm text-gray-500">
          Отфильтруйте список по названию или тегу и добавьте новые активности.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          placeholder="Фильтр по названию"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:max-w-xs"
        />
        <input
          placeholder="Фильтр по тегу"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:max-w-xs"
        />
        <span className="text-xs text-gray-500 sm:self-center">Показано: {filtered.length}</span>
      </div>

      <ul className="space-y-3">
        {filtered.map((ev) => (
          <li
            key={ev.id}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6"
          >
            <p className="text-sm font-medium text-gray-900">{ev.name}</p>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
            Подходящих мероприятий не найдено
          </li>
        )}
      </ul>

      <form
        onSubmit={handleAdd}
        className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div>
          <h3 className="text-lg font-medium text-gray-900">Добавить мероприятие</h3>
          <p className="text-sm text-gray-500">Создайте новый пункт в расписании</p>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700" htmlFor="event-name">
            Название
          </label>
          <input
            id="event-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Введите название мероприятия"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Добавить
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminEventsPage;

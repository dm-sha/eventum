import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getEventumBySlug } from "../../api/eventum";

const AdminInfoPage = () => {
  const { eventumSlug } = useParams();
  const [name, setName] = useState("");

  useEffect(() => {
    if (eventumSlug) {
      getEventumBySlug(eventumSlug).then((data) => setName(data.name));
    }
  }, [eventumSlug]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Здесь будет логика сохранения
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-gray-900">Общая информация</h2>
        <p className="text-sm text-gray-500">
          Обновите название группы мероприятий. Изменения вступят в силу сразу после сохранения.
        </p>
      </header>
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700" htmlFor="eventum-name">
            Название
          </label>
          <input
            id="eventum-name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Введите название"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Сохранить
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminInfoPage;

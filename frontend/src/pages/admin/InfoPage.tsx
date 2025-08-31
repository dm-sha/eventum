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
    <div>
      <h2 className="text-xl font-semibold mb-4">Общая информация</h2>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Название
          </label>
          <input
            className="w-full border border-gray-300 rounded px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Сохранить
        </button>
      </form>
    </div>
  );
};

export default AdminInfoPage;

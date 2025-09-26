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
    <div>
      <h2 className="text-xl font-semibold mb-4">Участники</h2>
      <div className="mb-4 flex gap-4 flex-wrap">
        <input
          placeholder="Фильтр по имени"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1"
        />
      </div>
      <ul className="space-y-2">
        {filtered.map((p) => (
          <li key={p.id} className="p-2 border border-gray-200 rounded bg-white">
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminParticipantsPage;

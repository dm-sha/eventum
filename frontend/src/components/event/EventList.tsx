import { useState, useEffect } from "react";
import { getEventsForEventum } from "../../api";
import type { Event as EventType } from "../../types"; // 'Event' - зарезервированное слово
import LoadingSpinner from "../LoadingSpinner";

interface EventListProps {
  eventumSlug: string;
}

// Функция для форматирования даты для лучшей читаемости
const formatDateTime = (isoString: string) => {
  return new Date(isoString).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const EventList = ({ eventumSlug }: EventListProps) => {
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const data = await getEventsForEventum(eventumSlug);
        setEvents(data);
      } catch (err) {
        setError("Не удалось загрузить список мероприятий.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [eventumSlug]);

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-center text-red-400">{error}</p>;

  return (
    <div className="mt-6 space-y-4">
      {events.length > 0 ? (
        events.map((event) => (
          <div key={event.id} className="p-4 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800">
              {event.name}
            </h3>
            <p className="text-sm text-gray-600 mt-1">{event.description}</p>
            <div className="text-sm text-gray-500 mt-2">
              <span>{formatDateTime(event.start_time)}</span> -{" "}
              <span>{formatDateTime(event.end_time)}</span>
            </div>
          </div>
        ))
      ) : (
        <p className="text-gray-500">Мероприятия еще не добавлены.</p>
      )}
    </div>
  );
};

export default EventList;

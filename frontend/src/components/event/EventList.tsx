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
    <div className="space-y-4">
      {events.length > 0 ? (
        events.map((event) => (
          <article
            key={event.id}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">{event.name}</h3>
                {event.description && (
                  <p className="text-sm leading-6 text-gray-600">{event.description}</p>
                )}
              </div>
              <dl className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800 sm:px-4">
                <dt className="font-medium uppercase tracking-wide">Период</dt>
                <dd className="mt-1 space-y-1 text-blue-900">
                  <p>{formatDateTime(event.start_time)}</p>
                  <p>{formatDateTime(event.end_time)}</p>
                </dd>
              </dl>
            </div>
          </article>
        ))
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          Мероприятия еще не добавлены
        </div>
      )}
    </div>
  );
};

export default EventList;

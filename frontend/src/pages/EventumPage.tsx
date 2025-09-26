import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getEventumBySlug } from "../api/eventum";
import type { Eventum } from "../types";
import LoadingSpinner from "../components/LoadingSpinner";
import NotFoundPage from "./NotFoundPage";
import ParticipantList from "../components/participant/ParticipantList";
import EventList from "../components/event/EventList";

type Tab = 'participants' | 'events';

const EventumPage = () => {
  const { eventumSlug } = useParams<{ eventumSlug: string }>();
  const [eventum, setEventum] = useState<Eventum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('participants'); // Состояние для вкладок

  useEffect(() => {
    if (!eventumSlug) return;
    const fetchEventum = async () => {
      try {
        setLoading(true);
        const data = await getEventumBySlug(eventumSlug);
        setEventum(data);
      } catch (err) {
        setError("Мероприятие не найдено.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEventum();
  }, [eventumSlug]);

  if (loading) return <LoadingSpinner />;
  if (!eventum || !eventumSlug) return <NotFoundPage />; // Добавил !eventumSlug для TS
  if (error) return <p className="text-center text-red-400">{error}</p>;

  // Стили для вкладок (используем Tailwind CSS)
  const getTabClassName = (tabName: Tab) => {
    return `px-4 py-2 text-sm font-medium rounded-md focus:outline-none ${
      activeTab === tabName
        ? 'bg-blue-600 text-white'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    }`;
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-wide text-blue-600">
              Группа мероприятий
            </p>
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              {eventum.name}
            </h1>
          </div>
          <Link
            to={`/${eventumSlug}/admin`}
            className="inline-flex items-center justify-center rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Админка
          </Link>
        </div>

        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="space-y-6 px-4 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 pb-4">
              <button
                onClick={() => setActiveTab('participants')}
                className={getTabClassName('participants')}
              >
                Участники
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className={getTabClassName('events')}
              >
                Мероприятия
              </button>
            </div>

            <div className="space-y-6">
              <div className={activeTab === 'participants' ? 'block' : 'hidden'}>
                <ParticipantList eventumSlug={eventumSlug} />
              </div>
              <div className={activeTab === 'events' ? 'block' : 'hidden'}>
                <EventList eventumSlug={eventumSlug} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default EventumPage;
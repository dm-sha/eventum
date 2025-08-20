import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          {eventum.name}
        </h1>

        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          {/* Панель с вкладками */}
          <div className="flex space-x-4 border-b border-gray-200 pb-4 mb-4">
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

          {/* Содержимое вкладок */}
          <div>
            <div className={activeTab === 'participants' ? '' : 'hidden'}>
              <ParticipantList eventumSlug={eventumSlug} />
            </div>
            <div className={activeTab === 'events' ? '' : 'hidden'}>
              <EventList eventumSlug={eventumSlug} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default EventumPage;

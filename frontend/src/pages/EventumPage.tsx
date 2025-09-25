import { Link, useParams } from 'react-router-dom';
import { getEventumBySlug } from '../api/eventum';
import { useEffect, useState } from 'react';
import type { Eventum } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

export default function EventumPage() {
  const { eventumSlug } = useParams<{ eventumSlug: string }>();
  const [eventum, setEventum] = useState<Eventum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventumSlug) {
      setError('Eventum slug не найден');
      setLoading(false);
      return;
    }

    const fetchEventum = async () => {
      try {
        setLoading(true);
        const data = await getEventumBySlug(eventumSlug);
        setEventum(data);
      } catch (err) {
        console.error('Ошибка загрузки eventum:', err);
        setError('Не удалось загрузить мероприятие');
      } finally {
        setLoading(false);
      }
    };

    fetchEventum();
  }, [eventumSlug]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !eventum) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Link to="/" className="text-blue-600 hover:text-blue-800">
              ← Назад к списку мероприятий
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Ошибка</h1>
            <p className="text-gray-600">{error || 'Мероприятие не найдено'}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-blue-600 hover:text-blue-800">
            ← Назад к списку мероприятий
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{eventum.name}</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Детали</h2>
            <div className="space-y-2">
              <p><span className="font-medium">Slug:</span> {eventum.slug}</p>
              <p><span className="font-medium">ID:</span> {eventum.id}</p>
              {/* Add more eventum details here as needed */}
            </div>
          </div>
          
          {/* Placeholder for future sections */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Содержимое мероприятия</h2>
            <p className="text-gray-600">Больше контента скоро...</p>
          </div>
        </div>
      </div>
    </main>
  );
}
import { useState, useEffect } from 'react';
import { getParticipantsForEventum } from '../../api';
import type { Participant } from '../../types';
import LoadingSpinner from '../LoadingSpinner';

interface ParticipantListProps {
  eventumSlug: string;
}

const ParticipantList = ({ eventumSlug }: ParticipantListProps) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        setLoading(true);
        const data = await getParticipantsForEventum(eventumSlug);
        setParticipants(data);
      } catch (err) {
        setError('Не удалось загрузить список участников.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchParticipants();
  }, [eventumSlug]);

  if (loading) return <LoadingSpinner />;
  if (error) return <p className="text-center text-red-400">{error}</p>;

  return (
    <div className="mt-2 space-y-4">
      {participants.length > 0 ? (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
          {participants.map((participant) => (
            <li key={participant.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
              {participant.user?.avatar_url ? (
                <img
                  src={participant.user.avatar_url}
                  alt={participant.name}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                  <span className="text-xs font-medium text-gray-600">
                    {participant.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">{participant.name}</span>
                {participant.user ? (
                  <span className="text-xs text-gray-500">
                    VK ID: {participant.user.vk_id}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">
                    ID: {participant.id} (без пользователя)
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          Участники еще не добавлены
        </div>
      )}
    </div>
  );
};

export default ParticipantList;

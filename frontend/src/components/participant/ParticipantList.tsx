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
            <li key={participant.id} className="flex flex-col gap-1 px-4 py-3 sm:px-6">
              <span className="text-sm font-medium text-gray-900">{participant.name}</span>
              <span className="text-xs text-gray-500">ID: {participant.id}</span>
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

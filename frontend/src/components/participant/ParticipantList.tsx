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
    <div className="mt-6">
      {participants.length > 0 ? (
        <ul className="divide-y divide-gray-200">
          {participants.map((participant) => (
            <li key={participant.id} className="py-3">
              <p className="text-md text-gray-800">{participant.name}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">Участники еще не добавлены.</p>
      )}
    </div>
  );
};

export default ParticipantList;

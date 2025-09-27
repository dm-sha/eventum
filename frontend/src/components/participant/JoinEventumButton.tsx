import { useState } from 'react';
import { joinEventum, leaveEventum, getMyParticipant } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import type { Participant } from '../../types';

interface JoinEventumButtonProps {
  eventumSlug: string;
  onJoin?: (participant: Participant) => void;
  onLeave?: () => void;
}

const JoinEventumButton = ({ eventumSlug, onJoin, onLeave }: JoinEventumButtonProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isParticipant, setIsParticipant] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkParticipantStatus = async () => {
    if (!user) return;
    
    try {
      await getMyParticipant(eventumSlug);
      setIsParticipant(true);
    } catch (err) {
      setIsParticipant(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      setError('Необходимо войти в систему');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const participant = await joinEventum(eventumSlug);
      setIsParticipant(true);
      onJoin?.(participant);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Не удалось присоединиться к мероприятию');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!user) {
      setError('Необходимо войти в систему');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await leaveEventum(eventumSlug);
      setIsParticipant(false);
      onLeave?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Не удалось покинуть мероприятие');
    } finally {
      setLoading(false);
    }
  };

  // Проверяем статус участника при монтировании компонента
  useState(() => {
    checkParticipantStatus();
  });

  if (!user) {
    return (
      <div className="text-center text-sm text-gray-500">
        Войдите в систему, чтобы присоединиться к мероприятию
      </div>
    );
  }

  if (isParticipant === null) {
    return (
      <div className="text-center text-sm text-gray-500">
        Проверка статуса участника...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      
      {isParticipant ? (
        <button
          onClick={handleLeave}
          disabled={loading}
          className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Покидаем...' : 'Покинуть мероприятие'}
        </button>
      ) : (
        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Присоединяемся...' : 'Присоединиться к мероприятию'}
        </button>
      )}
    </div>
  );
};

export default JoinEventumButton;

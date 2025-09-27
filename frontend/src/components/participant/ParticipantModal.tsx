import { useState, useEffect } from "react";
import { IconX, IconUser } from "../icons";
import type { Participant } from "../../types";

interface ParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string }) => Promise<void>;
  participant?: Participant | null;
  isLoading?: boolean;
}

const ParticipantModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  participant,
  isLoading = false
}: ParticipantModalProps) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (participant) {
      setName(participant.name);
    } else {
      setName("");
    }
  }, [participant, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await onSave({ name: name.trim() });
      onClose();
    } catch (error) {
      console.error("Ошибка при сохранении участника:", error);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {participant ? "Редактировать участника" : "Добавить участника"}
          </h3>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Имя участника *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50"
              placeholder="Введите имя участника"
            />
          </div>


          {participant?.groups && participant.groups.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Группы участника
              </label>
              <div className="space-y-1">
                {participant.groups.map((group) => (
                  <div key={group.id} className="flex items-center gap-2 text-sm">
                    <IconUser size={16} className="text-gray-400" />
                    <span className="text-gray-900">{group.name}</span>
                    {group.tags && group.tags.length > 0 && (
                      <div className="flex gap-1">
                        {group.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Сохранение..." : participant ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ParticipantModal;

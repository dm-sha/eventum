import { useState, useEffect } from "react";
import { IconX, IconUser, IconSearch, IconCheck } from "../icons";
import type { Participant, User } from "../../types";
import { searchUsers } from "../../api/organizers";

interface ParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; user_id?: number | null }) => Promise<void>;
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
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    if (participant) {
      setName(participant.name);
      setSelectedUser(participant.user || null);
      setUserSearchQuery(participant.user?.name || "");
    } else {
      setName("");
      setSelectedUser(null);
      setUserSearchQuery("");
    }
  }, [participant, isOpen]);

  // Дополнительная синхронизация: если поле поиска пустое, но selectedUser не null, очищаем selectedUser
  useEffect(() => {
    if (!userSearchQuery.trim() && selectedUser) {
      setSelectedUser(null);
    }
  }, [userSearchQuery, selectedUser]);

  // Закрытие выпадающего списка при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.user-search-container')) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserDropdown]);

  // Функция поиска пользователей
  const handleUserSearch = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const users = await searchUsers(query);
      setSearchResults(users);
      setShowUserDropdown(true);
    } catch (error) {
      console.error("Ошибка при поиске пользователей:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Обработчик выбора пользователя
  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setUserSearchQuery(user.name);
    setShowUserDropdown(false);
    setSearchResults([]);
  };

  // Обработчик очистки выбора пользователя
  const handleUserClear = () => {
    setSelectedUser(null);
    setUserSearchQuery("");
    setShowUserDropdown(false);
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      // Если поле поиска пустое, но selectedUser не null, очищаем связь
      const user_id = (userSearchQuery.trim() && selectedUser) ? selectedUser.id : null;
      
      await onSave({ 
        name: name.trim(), 
        user_id: user_id
      });
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

          <div className="relative user-search-container">
            <label htmlFor="user-search" className="block text-sm font-medium text-gray-700 mb-1">
              VK
            </label>
            <div className="relative">
              <input
                id="user-search"
                type="text"
                value={userSearchQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setUserSearchQuery(value);
                  
                  // Если поле пустое, очищаем выбранного пользователя
                  if (!value.trim()) {
                    setSelectedUser(null);
                    setSearchResults([]);
                    setShowUserDropdown(false);
                    return;
                  }
                  
                  // Если пользователь начал печатать и у нас есть выбранный пользователь,
                  // но текст не совпадает с именем выбранного пользователя, очищаем выбор
                  if (selectedUser && value !== selectedUser.name) {
                    setSelectedUser(null);
                  }
                  
                  handleUserSearch(value);
                }}
                onFocus={() => setShowUserDropdown(true)}
                disabled={isLoading}
                className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 ${
                  selectedUser 
                    ? 'border-green-300 bg-green-50 focus:border-green-500 focus:ring-green-200' 
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                }`}
                placeholder="Поиск пользователя по имени..."
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {isSearching ? (
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                ) : (
                  <IconSearch size={16} className="text-gray-400" />
                )}
              </div>
              
              {(selectedUser || userSearchQuery) && (
                <button
                  type="button"
                  onClick={handleUserClear}
                  className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <IconX size={16} />
                </button>
              )}
            </div>

            {/* Выпадающий список результатов поиска */}
            {showUserDropdown && (searchResults.length > 0 || selectedUser) && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {/* Опция очистки выбора */}
                {selectedUser && (
                  <button
                    type="button"
                    onClick={handleUserClear}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center gap-3 text-gray-500 border-b border-gray-200"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <IconX size={16} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Очистить выбор</div>
                      <div className="text-xs">Отвязать пользователя</div>
                    </div>
                  </button>
                )}
                
                {/* Показываем выбранного пользователя, если он не в результатах поиска */}
                {selectedUser && !searchResults.some(user => user.id === selectedUser.id) && (
                  <button
                    type="button"
                    onClick={() => handleUserSelect(selectedUser)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center gap-3 bg-blue-50 border-l-4 border-blue-500"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      {selectedUser.avatar_url ? (
                        <img
                          src={selectedUser.avatar_url}
                          alt={selectedUser.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <IconUser size={16} className="text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{selectedUser.name}</div>
                      <div className="text-xs text-gray-500">VK ID: {selectedUser.vk_id}</div>
                    </div>
                    <div className="text-blue-600">
                      <IconCheck size={16} />
                    </div>
                  </button>
                )}
                
                {/* Результаты поиска */}
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleUserSelect(user)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center gap-3 ${
                      selectedUser?.id === user.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <IconUser size={16} className="text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">VK ID: {user.vk_id}</div>
                    </div>
                    {selectedUser?.id === user.id && (
                      <div className="text-blue-600">
                        <IconCheck size={16} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
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

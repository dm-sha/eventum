import { useState, useEffect } from "react";
import { IconX, IconUser, IconSearch, IconCheck } from "../icons";
import type { Participant, User } from "../../types";
import { searchUsers } from "../../api/organizers";
import { usersApi } from "../../api/eventumApi";

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
  const [showAddUserModal, setShowAddUserModal] = useState(false);

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
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="user-search" className="block text-sm font-medium text-gray-700">
                VK
              </label>
              <button
                type="button"
                onClick={() => setShowAddUserModal(true)}
                disabled={isLoading}
                className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                + Добавить VK пользователя
              </button>
            </div>
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
      
      {/* Модальное окно для добавления VK пользователя */}
      {showAddUserModal && (
        <AddVKUserModal
          isOpen={showAddUserModal}
          onClose={() => setShowAddUserModal(false)}
          onUserCreated={(user) => {
            setSelectedUser(user);
            setUserSearchQuery(user.name);
            setShowAddUserModal(false);
          }}
        />
      )}
    </div>
  );
};

// Компонент для добавления VK пользователя
interface AddVKUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (user: User) => void;
}

const AddVKUserModal = ({ isOpen, onClose, onUserCreated }: AddVKUserModalProps) => {
  const [userName, setUserName] = useState("");
  const [vkId, setVkId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{name?: string; vk_id?: string}>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !vkId.trim()) return;

    setIsLoading(true);
    setError("");
    setFieldErrors({});

    try {
      const newUser = await usersApi.create({ 
        name: userName.trim(), 
        vk_id: parseInt(vkId) 
      });
      onUserCreated(newUser.data);
    } catch (error: any) {
      console.error("Ошибка при создании пользователя:", error);
      
      // Обрабатываем ошибки полей
      if (error?.response?.data) {
        const errorData = error.response.data;
        
        // Обрабатываем ошибки полей
        if (errorData.vk_id) {
          const vkIdError = Array.isArray(errorData.vk_id) ? errorData.vk_id[0] : errorData.vk_id;
          if (vkIdError.includes('already exists')) {
            setFieldErrors({vk_id: "Пользователь с таким VK ID уже существует"});
          } else {
            setFieldErrors({vk_id: vkIdError});
          }
        }
        
        if (errorData.name) {
          const nameError = Array.isArray(errorData.name) ? errorData.name[0] : errorData.name;
          setFieldErrors(prev => ({...prev, name: nameError}));
        }
        
        // Общие ошибки
        if (errorData.detail) {
          setError(errorData.detail);
        } else if (errorData.non_field_errors) {
          setError(Array.isArray(errorData.non_field_errors) 
            ? errorData.non_field_errors.join(', ')
            : errorData.non_field_errors);
        } else if (!errorData.vk_id && !errorData.name) {
          setError("Ошибка при создании пользователя");
        }
      } else if (error?.message) {
        setError(error.message);
      } else {
        setError("Ошибка при создании пользователя");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setUserName("");
      setVkId("");
      setError("");
      setFieldErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Добавить VK пользователя
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
            <label htmlFor="user-name" className="block text-sm font-medium text-gray-700 mb-1">
              Имя пользователя *
            </label>
            <input
              id="user-name"
              type="text"
              value={userName}
              onChange={(e) => {
                setUserName(e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors(prev => ({...prev, name: undefined}));
                }
              }}
              required
              disabled={isLoading}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 ${
                fieldErrors.name 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
              }`}
              placeholder="Введите имя пользователя"
            />
            {fieldErrors.name && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="vk-id" className="block text-sm font-medium text-gray-700 mb-1">
              VK ID *
            </label>
            <input
              id="vk-id"
              type="number"
              value={vkId}
              onChange={(e) => {
                setVkId(e.target.value);
                if (fieldErrors.vk_id) {
                  setFieldErrors(prev => ({...prev, vk_id: undefined}));
                }
              }}
              required
              disabled={isLoading}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-50 ${
                fieldErrors.vk_id 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
              }`}
              placeholder="Введите VK ID"
            />
            {fieldErrors.vk_id && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.vk_id}</p>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
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
              disabled={isLoading || !userName.trim() || !vkId.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ParticipantModal;

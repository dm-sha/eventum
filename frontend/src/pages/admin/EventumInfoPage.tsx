import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getEventumDetails, updateEventumName, updateEventumDescription } from "../../api/eventum";
import { addEventumOrganizer, removeEventumOrganizer, searchUsers } from "../../api/organizers";
import { useAuth } from "../../contexts/AuthContext";
import type { EventumDetails, User } from "../../types";
import { 
  IconPencil, 
  IconPlus, 
  IconTrash,
  IconUsers,
  IconCalendar,
  IconSettings,
  IconX
} from "../../components/icons";


const EventumInfoPage = () => {
  const { eventumSlug } = useParams();
  const { user } = useAuth();
  const [eventum, setEventum] = useState<EventumDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempDescription, setTempDescription] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  
  // Состояние для модального окна добавления организатора
  const [isAddOrganizerModalOpen, setIsAddOrganizerModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (eventumSlug) {
      loadEventumData();
    }
  }, [eventumSlug]);

  const loadEventumData = async () => {
    if (!eventumSlug) return;
    
    setIsLoading(true);
    try {
      const eventumData = await getEventumDetails(eventumSlug);
      setEventum(eventumData);
      setTempName(eventumData.name);
      setTempDescription(eventumData.description || "");
    } catch (error) {
      console.error('Ошибка загрузки данных eventum:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!eventumSlug || !eventum) return;
    
    setIsSavingName(true);
    try {
      const updatedEventum = await updateEventumName(eventumSlug, tempName);
      setEventum({ ...eventum, name: updatedEventum.name });
      setIsEditingName(false);
    } catch (error) {
      console.error('Ошибка сохранения названия:', error);
      setTempName(eventum.name); // Возвращаем исходное значение
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelNameEdit = () => {
    if (eventum) {
      setTempName(eventum.name);
    }
    setIsEditingName(false);
  };

  const handleSaveDescription = async () => {
    if (!eventumSlug || !eventum) return;
    
    setIsSavingDescription(true);
    try {
      const updatedEventum = await updateEventumDescription(eventumSlug, tempDescription);
      setEventum({ ...eventum, description: updatedEventum.description });
      setIsEditingDescription(false);
    } catch (error) {
      console.error('Ошибка сохранения описания:', error);
      setTempDescription(eventum.description || ""); // Возвращаем исходное значение
    } finally {
      setIsSavingDescription(false);
    }
  };

  const handleCancelDescriptionEdit = () => {
    if (eventum) {
      setTempDescription(eventum.description || "");
    }
    setIsEditingDescription(false);
  };

  const handleAddOrganizer = () => {
    setIsAddOrganizerModalOpen(true);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSearchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchUsers(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Ошибка поиска пользователей:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddUserAsOrganizer = async (userId: number) => {
    if (!eventumSlug || !eventum) return;

    try {
      const newOrganizerRole = await addEventumOrganizer(eventumSlug, userId);
      // Обновляем список организаторов
      setEventum({ 
        ...eventum, 
        organizers: [...eventum.organizers, newOrganizerRole] 
      });
      setIsAddOrganizerModalOpen(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      console.error('Ошибка добавления организатора:', error);
      alert('Не удалось добавить организатора. Возможно, пользователь уже является организатором.');
    }
  };

  const closeAddOrganizerModal = () => {
    setIsAddOrganizerModalOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemoveOrganizer = async (roleId: number, organizerUserId: number) => {
    if (!eventumSlug || !eventum || !user) return;
    
    // Проверяем, не пытается ли пользователь удалить себя
    if (organizerUserId === user.id) {
      alert('Вы не можете удалить себя из списка организаторов.');
      return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить этого организатора?')) {
      return;
    }
    
    try {
      await removeEventumOrganizer(eventumSlug, roleId);
      // Обновляем список организаторов
      const updatedOrganizers = eventum.organizers.filter(org => org.id !== roleId);
      setEventum({ ...eventum, organizers: updatedOrganizers });
    } catch (error) {
      console.error('Ошибка удаления организатора:', error);
      alert('Не удалось удалить организатора. Возможно, это последний организатор мероприятия.');
    }
  };

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!eventum) {
    return (
      <div className="text-center p-8 text-gray-500">
        Мероприятие не найдено
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок с названием мероприятия */}
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="text-3xl font-bold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none focus:border-blue-600 min-w-0 flex-1"
                  style={{ 
                    minWidth: `${Math.max(tempName.length * 20, 300)}px`,
                    width: 'auto'
                  }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveName();
                    } else if (e.key === 'Escape') {
                      handleCancelNameEdit();
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveName}
                    disabled={isSavingName}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingName ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button
                    onClick={handleCancelNameEdit}
                    disabled={isSavingName}
                    className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Отменить
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{eventum.name}</h1>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Редактировать название"
                >
                  <IconPencil size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Описание мероприятия */}
      <section className="space-y-3">
        <div className="flex items-center justify-end">
          <button
            onClick={() => setIsEditingDescription(true)}
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Редактировать описание"
          >
            <IconPencil size={16} />
          </button>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          {isEditingDescription ? (
            <div className="space-y-3">
              <textarea
                value={tempDescription}
                onChange={(e) => setTempDescription(e.target.value)}
                className="w-full bg-transparent border-none focus:outline-none resize-none"
                rows={4}
                placeholder="Введите описание мероприятия..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleSaveDescription();
                  } else if (e.key === 'Escape') {
                    handleCancelDescriptionEdit();
                  }
                }}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleSaveDescription}
                  disabled={isSavingDescription}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingDescription ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  onClick={handleCancelDescriptionEdit}
                  disabled={isSavingDescription}
                  className="px-3 py-1.5 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Отменить
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap">
              {eventum.description || (
                <span 
                  className="text-gray-400 cursor-pointer hover:text-gray-500 transition-colors"
                  onClick={() => setIsEditingDescription(true)}
                >
                  Описание мероприятия не указано
                </span>
              )}
            </p>
          )}
        </div>
      </section>

      {/* Информация о мероприятии */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Информация</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <IconUsers size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Участников</p>
                <p className="text-2xl font-bold text-gray-900">{eventum.participants_count}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <IconCalendar size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Мероприятий</p>
                <p className="text-2xl font-bold text-gray-900">{eventum.events_count}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Секция настроек */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <IconSettings size={20} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Настройки</h2>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-md font-medium text-gray-900">Организаторы</h3>
            <button
              onClick={handleAddOrganizer}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <IconPlus size={14} />
              Добавить
            </button>
          </div>
          
          {eventum.organizers && eventum.organizers.length > 0 ? (
            <div className="space-y-2">
              {eventum.organizers.map((organizerRole) => (
                <div
                  key={organizerRole.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {organizerRole.user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{organizerRole.user.name}</p>
                      <p className="text-sm text-gray-500">{organizerRole.user.email}</p>
                    </div>
                  </div>
                  {organizerRole.user.id !== user?.id && (
                    <button
                      onClick={() => handleRemoveOrganizer(organizerRole.id, organizerRole.user.id)}
                      className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Удалить организатора"
                    >
                      <IconTrash size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p>Организаторы не назначены</p>
            </div>
          )}
        </div>
      </section>

      {/* Модальное окно добавления организатора */}
      {isAddOrganizerModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Добавить организатора</h3>
              <button
                onClick={closeAddOrganizerModal}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <IconX size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Поиск пользователей
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearchUsers(e.target.value);
                  }}
                  placeholder="Введите имя пользователя..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  autoFocus
                />
              </div>
              
              {isSearching && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              )}
              
              {searchResults.length > 0 && (
                <div className="max-h-60 overflow-y-auto">
                  <div className="space-y-2">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddUserAsOrganizer(user.id)}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Добавить
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <p>Пользователи не найдены</p>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={closeAddOrganizerModal}
                className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Отменить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventumInfoPage;

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
    
    try {
      const updatedEventum = await updateEventumName(eventumSlug, tempName);
      setEventum({ ...eventum, name: updatedEventum.name });
      setIsEditingName(false);
    } catch (error) {
      console.error('Ошибка сохранения названия:', error);
      setTempName(eventum.name); // Возвращаем исходное значение
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
    
    try {
      const updatedEventum = await updateEventumDescription(eventumSlug, tempDescription);
      setEventum({ ...eventum, description: updatedEventum.description });
      setIsEditingDescription(false);
    } catch (error) {
      console.error('Ошибка сохранения описания:', error);
      setTempDescription(eventum.description || ""); // Возвращаем исходное значение
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-2xl font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveName();
                    } else if (e.key === 'Escape') {
                      handleCancelNameEdit();
                    }
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSaveName}
                    className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={handleCancelNameEdit}
                    className="inline-flex items-center justify-center rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                  >
                    Отменить
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-balance text-3xl font-bold text-gray-900 sm:text-4xl">
                  {eventum.name}
                </h1>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  title="Редактировать название"
                >
                  <IconPencil size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Описание мероприятия */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Описание</h2>
          {!isEditingDescription && (
            <button
              onClick={() => setIsEditingDescription(true)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
            >
              <IconPencil size={14} />
              Редактировать
            </button>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          {isEditingDescription ? (
            <div className="space-y-4">
              <textarea
                value={tempDescription}
                onChange={(e) => setTempDescription(e.target.value)}
                className="h-40 w-full resize-none rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:text-base"
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={handleSaveDescription}
                  className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
                >
                  Сохранить
                </button>
                <button
                  onClick={handleCancelDescriptionEdit}
                  className="inline-flex items-center justify-center rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                >
                  Отменить
                </button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 sm:text-base">
              {eventum.description || (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-left text-gray-400 transition-colors hover:text-gray-500"
                  onClick={() => setIsEditingDescription(true)}
                >
                  <IconPencil size={14} />
                  Описание мероприятия не указано
                </button>
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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-gray-900">Организаторы</h3>
            <button
              onClick={handleAddOrganizer}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              <IconPlus size={14} />
              Добавить организатора
            </button>
          </div>

          {eventum.organizers && eventum.organizers.length > 0 ? (
            <div className="space-y-3">
              {eventum.organizers.map((organizerRole) => (
                <div
                  key={organizerRole.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white">
                        <span className="text-base font-semibold">
                          {organizerRole.user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 sm:text-base">
                          {organizerRole.user.name}
                        </p>
                        <p className="truncate text-xs text-gray-500 sm:text-sm">
                          {organizerRole.user.email}
                        </p>
                      </div>
                    </div>
                    {organizerRole.user.id !== user?.id && (
                      <button
                        onClick={() => handleRemoveOrganizer(organizerRole.id, organizerRole.user.id)}
                        className="inline-flex items-center justify-center rounded-full p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Удалить организатора"
                      >
                        <IconTrash size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              <p>Организаторы не назначены</p>
            </div>
          )}
        </div>
      </section>

      {/* Модальное окно добавления организатора */}
        {isAddOrganizerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-organizer-title"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 id="add-organizer-title" className="text-lg font-semibold text-gray-900">
                  Добавить организатора
                </h3>
                <button
                  onClick={closeAddOrganizerModal}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Закрыть"
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
                  <div className="max-h-60 overflow-y-auto pr-1">
                    <div className="space-y-2">
                      {searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white">
                              <span className="text-sm font-semibold">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                              <p className="text-xs text-gray-500 sm:text-sm">{user.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddUserAsOrganizer(user.id)}
                            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
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
            
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={closeAddOrganizerModal}
                  className="inline-flex items-center justify-center rounded-lg bg-gray-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
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

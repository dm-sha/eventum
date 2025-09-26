import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserEventums } from '../api/event';

interface UserEventum {
  id: number;
  name: string;
  slug: string;
  description: string;
  created_at: string;
  user_role: 'organizer' | 'participant';
  role_id: number;
}

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [eventums, setEventums] = useState<UserEventum[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventumsLoaded, setEventumsLoaded] = useState(false);

        // Загружаем eventum'ы пользователя
        useEffect(() => {
            const loadEventums = async () => {
                setEventumsLoaded(true);
                try {
                    const userEventums = await getUserEventums();
                    setEventums(userEventums);
                } catch (error: any) {
                    console.error('Ошибка загрузки eventum\'ов:', error);

                    // Если получили 403 или 401, перенаправляем на страницу входа
                    if (error.response?.status === 403 || error.response?.status === 401) {
                        logout();
                        return;
                    }
                } finally {
                    setLoading(false);
                }
            };

            // Загружаем eventum'ы только если пользователь авторизован и eventum'ы еще не загружены
            if (user && !eventumsLoaded) {
                loadEventums();
            }
        }, [user, eventumsLoaded, logout]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Eventum</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {user && (
                <div className="flex items-center space-x-3">
                  {user.avatar_url && (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="h-8 w-8 rounded-full"
                    />
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    {user.name}
                  </span>
                </div>
              )}
              
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Панель управления
                </h2>
              </div>
              
              {user && (
                <div className="space-y-6">
                  {/* User Info */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Информация о пользователе
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Имя
                        </label>
                        <p className="mt-1 text-sm text-gray-900">{user.name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          VK ID
                        </label>
                        <p className="mt-1 text-sm text-gray-900">{user.vk_id}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Email
                        </label>
                        <p className="mt-1 text-sm text-gray-900">
                          {user.email || 'Не указан'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Дата регистрации
                        </label>
                        <p className="mt-1 text-sm text-gray-900">
                          {new Date(user.date_joined).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Eventums List */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Мои группы мероприятий ({eventums.length})
                    </h3>
                    
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-2 text-gray-600">Загрузка групп мероприятий...</p>
                      </div>
                    ) : eventums.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <p className="text-gray-600">У вас пока нет групп мероприятий</p>
                        <p className="text-sm text-gray-500 mt-1">Обратитесь к администратору для добавления в группу</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {eventums.map((eventum) => (
                          <div key={eventum.id} className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <h4 className="text-lg font-medium text-gray-900">
                                    {eventum.name}
                                  </h4>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    eventum.user_role === 'organizer' 
                                      ? 'bg-purple-100 text-purple-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {eventum.user_role === 'organizer' ? 'Организатор' : 'Участник'}
                                  </span>
                                </div>
                                {eventum.description && (
                                  <p className="text-sm text-gray-700 mb-2">
                                    {eventum.description}
                                  </p>
                                )}
                                <div className="text-sm text-gray-500">
                                  <p>Создано: {new Date(eventum.created_at).toLocaleDateString('ru-RU')}</p>
                                </div>
                              </div>
                              <div className="flex space-x-2 ml-4">
                                <button
                                  onClick={() => navigate(`/${eventum.slug}`)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                                >
                                  Перейти к группе
                                </button>
                                {eventum.user_role === 'organizer' && (
                                  <button
                                    onClick={() => navigate(`/${eventum.slug}/admin`)}
                                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition-colors"
                                  >
                                    Админка
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;

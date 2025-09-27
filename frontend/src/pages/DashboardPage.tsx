import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserEventums } from '../api/event';
import { createEventum } from '../api/eventum';
import Header from '../components/Header';
import LoadingSpinner from '../components/LoadingSpinner';
import CreateEventumModal from '../components/CreateEventumModal';

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Загружаем eventum'ы пользователя
  useEffect(() => {
    const loadEventums = async () => {
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

    if (user) {
      loadEventums();
    }
  }, [user, logout]);

  const handleCreateEventum = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateEventumSubmit = async (data: { name: string; slug: string }) => {
    try {
      // Создаем новый eventum через API
      await createEventum(data);
      
      // Небольшая задержка для обновления ролей на сервере
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Обновляем список eventum'ов
      const userEventums = await getUserEventums();
      setEventums(userEventums);
    } catch (error) {
      console.error('Ошибка создания события:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {/* Профиль пользователя */}
        <section className="mb-8 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="px-4 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-lg"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ring-4 ring-white shadow-lg">
                  <span className="text-2xl font-semibold text-white">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm uppercase tracking-wide text-gray-400">Личный кабинет</p>
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{user?.name}</h1>
                {user?.email && <p className="text-sm text-gray-500">{user.email}</p>}
              </div>
            </div>
          </div>
        </section>

        {/* Мои события */}
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="px-4 py-6 sm:px-8 sm:py-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
                  Мои события
                </h2>
                <p className="text-sm text-gray-500">
                  Всего: {eventums.length}
                </p>
              </div>
              <button
                onClick={handleCreateEventum}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Создать событие
              </button>
            </div>

            {eventums.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
                <p className="text-base font-medium text-gray-700">
                  У вас пока нет событий
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {eventums.map((eventum) => (
                  <article
                    key={eventum.id}
                    onClick={() => navigate(`/${eventum.slug}`)}
                    className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:p-6"
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/${eventum.slug}`);
                      }
                    }}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {eventum.name}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              eventum.user_role === 'organizer'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {eventum.user_role === 'organizer' ? 'Организатор' : 'Участник'}
                          </span>
                        </div>

                        {eventum.description && (
                          <p className="text-sm text-gray-600">
                            {eventum.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 sm:text-sm">
                          <span>Создан: {new Date(eventum.created_at).toLocaleDateString('ru-RU')}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>Слаг: {eventum.slug}</span>
                        </div>
                      </div>

                      {eventum.user_role === 'organizer' && (
                        <div className="flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/${eventum.slug}/admin`);
                            }}
                            className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                          >
                            Админка
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Модальное окно создания события */}
        <CreateEventumModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateEventumSubmit}
        />
    </div>
  );
};

export default DashboardPage;

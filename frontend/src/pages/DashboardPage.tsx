import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserEventums } from '../api/event';
import Header from '../components/Header';

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
      <Header />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="space-y-8 px-4 py-6 sm:px-8 sm:py-8">
            <header className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-wide text-blue-600">
                Личный кабинет
              </p>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Панель управления
              </h1>
            </header>

            {user && (
              <div className="space-y-10">
                <section className="space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Информация о пользователе
                    </h2>
                    <p className="text-sm text-gray-500">
                      Проверьте актуальность данных профиля
                    </p>
                  </div>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Имя
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">{user.name}</dd>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        VK ID
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">{user.vk_id}</dd>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Email
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {user.email || 'Не указан'}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Дата регистрации
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {new Date(user.date_joined).toLocaleDateString('ru-RU')}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Мои группы мероприятий
                      </h2>
                      <p className="text-sm text-gray-500">
                        Всего: {eventums.length}
                      </p>
                    </div>
                  </div>

                  {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
                      <div className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                      <p className="text-sm font-medium text-gray-700">Загрузка групп мероприятий…</p>
                      <p className="text-xs text-gray-500">Это может занять несколько секунд</p>
                    </div>
                  ) : eventums.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center">
                      <p className="text-base font-medium text-gray-700">
                        У вас пока нет групп мероприятий
                      </p>
                      <p className="mt-2 text-sm text-gray-500">
                        Обратитесь к администратору, чтобы получить доступ к нужной группе
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {eventums.map((eventum) => (
                        <article
                          key={eventum.id}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-6"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
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
                                <p className="text-sm leading-6 text-gray-600">
                                  {eventum.description}
                                </p>
                              )}
                              <p className="text-xs uppercase tracking-wide text-gray-500">
                                Создано {new Date(eventum.created_at).toLocaleDateString('ru-RU')}
                              </p>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                              <button
                                onClick={() => navigate(`/${eventum.slug}`)}
                                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                              >
                                Перейти к группе
                              </button>
                              {eventum.user_role === 'organizer' && (
                                <button
                                  onClick={() => navigate(`/${eventum.slug}/admin`)}
                                  className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                                >
                                  Админка
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;

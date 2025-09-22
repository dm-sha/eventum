import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createEventum as createEventumRequest,
  getMyEventums,
} from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import type { DashboardEventum } from '../types';

const initialLoginState = { email: '', password: '' };
const initialRegisterState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
};
const initialEventForm = { name: '', password: '' };

type AuthView = 'login' | 'register';

const DashboardPage = () => {
  const { user, login, register, isLoading } = useAuth();
  const [authView, setAuthView] = useState<AuthView>('login');
  const [loginForm, setLoginForm] = useState(initialLoginState);
  const [registerForm, setRegisterForm] = useState(initialRegisterState);
  const [authError, setAuthError] = useState<string | null>(null);

  const [eventums, setEventums] = useState<DashboardEventum[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState(initialEventForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  const sortedEventums = useMemo(
    () =>
      [...eventums].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [eventums],
  );

  useEffect(() => {
    if (!user) {
      setEventums([]);
      return;
    }
    const load = async () => {
      setEventsLoading(true);
      setEventsError(null);
      try {
        const data = await getMyEventums();
        setEventums(data);
      } catch (error) {
        console.error('Не удалось загрузить мероприятия', error);
        setEventsError('Не удалось загрузить список мероприятий.');
      } finally {
        setEventsLoading(false);
      }
    };
    load();
  }, [user]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    try {
      await login({ email: loginForm.email, password: loginForm.password });
      setLoginForm(initialLoginState);
    } catch (error) {
      console.error('Ошибка авторизации', error);
      setAuthError('Не удалось войти. Проверьте email и пароль.');
    }
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    try {
      await register({
        email: registerForm.email,
        password: registerForm.password,
        first_name: registerForm.firstName,
        last_name: registerForm.lastName,
      });
      setRegisterForm(initialRegisterState);
    } catch (error) {
      console.error('Ошибка регистрации', error);
      setAuthError('Регистрация не удалась. Попробуйте снова.');
    }
  };

  const handleCreateEventum = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    if (!createForm.name.trim() || !createForm.password.trim()) {
      setCreateError('Введите название и пароль.');
      return;
    }
    setCreateLoading(true);
    try {
      const created = await createEventumRequest({
        name: createForm.name,
        password: createForm.password,
      });
      setEventums((prev) => [created, ...prev]);
      setCreateForm(initialEventForm);
      setCreateModalOpen(false);
    } catch (error) {
      console.error('Ошибка создания мероприятия', error);
      setCreateError('Не удалось создать мероприятие.');
    } finally {
      setCreateLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6 sm:p-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-6">
          Личный кабинет организатора
        </h1>
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-full border border-gray-200 overflow-hidden text-sm">
            <button
              type="button"
              className={`px-4 py-2 transition ${
                authView === 'login'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600'
              }`}
              onClick={() => {
                setAuthError(null);
                setAuthView('login');
              }}
            >
              Вход
            </button>
            <button
              type="button"
              className={`px-4 py-2 transition ${
                authView === 'register'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600'
              }`}
              onClick={() => {
                setAuthError(null);
                setAuthView('register');
              }}
            >
              Регистрация
            </button>
          </div>
        </div>
        {authError ? (
          <p className="text-sm text-red-500 text-center mb-4">{authError}</p>
        ) : null}

        {authView === 'login' ? (
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Пароль
              </label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
            >
              Войти
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя
                </label>
                <input
                  type="text"
                  value={registerForm.firstName}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({
                      ...prev,
                      firstName: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Фамилия
                </label>
                <input
                  type="text"
                  value={registerForm.lastName}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({
                      ...prev,
                      lastName: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm((prev) => ({ ...prev, email: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Пароль
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
            >
              Создать аккаунт
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-6 sm:p-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            Добро пожаловать, {user.first_name || user.email}!
          </h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">
            Управляйте мероприятиями Eventum, создавайте новые события и приглашайте команду.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateModalOpen(true);
            setCreateError(null);
          }}
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
        >
          Создать мероприятие
        </button>
      </div>

      <section className="bg-white rounded-xl shadow p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Мои мероприятия
          </h2>
          {eventsError ? (
            <p className="text-sm text-red-500">{eventsError}</p>
          ) : null}
        </div>
        {eventsLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : sortedEventums.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500">У вас пока нет мероприятий.</p>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="mt-4 inline-flex px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Создать первое мероприятие
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedEventums.map((item) => (
              <article
                key={item.id}
                className="border border-gray-200 rounded-lg p-5 flex flex-col gap-4 hover:border-blue-400 transition"
              >
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {item.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Роль: {item.role === 'organizer' ? 'Организатор' : 'Участник'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Создано {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Link
                    to={`/${item.slug}`}
                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                  >
                    Просмотр
                  </Link>
                  {item.role === 'organizer' ? (
                    <Link
                      to={`/${item.slug}/admin`}
                      className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Управлять
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {createModalOpen ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 relative">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Новое мероприятие
            </h3>
            {createError ? (
              <p className="text-sm text-red-500 mb-3">{createError}</p>
            ) : null}
            <form className="space-y-4" onSubmit={handleCreateEventum}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название мероприятия
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пароль для админки
                </label>
                <input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Этот пароль понадобится для подключения внешних интеграций и быстрого доступа.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {createLoading ? 'Создание…' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardPage;

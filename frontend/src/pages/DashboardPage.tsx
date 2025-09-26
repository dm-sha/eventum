import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserEvents, createEventWithOrganizer } from '../api/event';
import type { UserEvent, CreateEventData } from '../types';

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateEventData>({
    eventum_name: '',
    event_name: '',
    event_description: '',
    start_time: '',
    end_time: ''
  });

  // Загружаем мероприятия пользователя
  useEffect(() => {
    const loadEvents = async () => {
      console.log('Начинаем загрузку мероприятий...');
      setEventsLoaded(true);
      try {
        const userEvents = await getUserEvents();
        console.log('Мероприятия загружены:', userEvents);
        setEvents(userEvents);
      } catch (error) {
        console.error('Ошибка загрузки мероприятий:', error);
      } finally {
        setLoading(false);
      }
    };

    // Загружаем мероприятия только если пользователь авторизован и мероприятия еще не загружены
    if (user && !eventsLoaded) {
      console.log('Условие выполнено, загружаем мероприятия. Пользователь:', user.name);
      loadEvents();
    } else {
      console.log('Условие не выполнено. Пользователь:', !!user, 'eventsLoaded:', eventsLoaded);
    }
  }, [user, eventsLoaded]);

  // Обработка создания нового мероприятия
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newEvent = await createEventWithOrganizer(createFormData);
      setEvents(prev => [newEvent, ...prev]);
      setShowCreateForm(false);
      setCreateFormData({
        eventum_name: '',
        event_name: '',
        event_description: '',
        start_time: '',
        end_time: ''
      });
    } catch (error) {
      console.error('Ошибка создания мероприятия:', error);
      alert('Ошибка создания мероприятия');
    }
  };


  // Форматирование даты
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Получение статуса мероприятия
  const getEventStatus = (event: UserEvent) => {
    const now = new Date();
    const startTime = new Date(event.start_time);
    const endTime = new Date(event.end_time);

    if (now < startTime) {
      return { status: 'upcoming', color: 'text-green-600', bg: 'bg-green-50' };
    } else if (now >= startTime && now <= endTime) {
      return { status: 'ongoing', color: 'text-blue-600', bg: 'bg-blue-50' };
    } else {
      return { status: 'past', color: 'text-gray-600', bg: 'bg-gray-50' };
    }
  };

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
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Мои мероприятия
              </h2>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Создать мероприятие
                </button>
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

                  {/* Create Event Form */}
                  {showCreateForm && (
                  <div className="bg-blue-50 rounded-lg p-6">
                      <h3 className="text-lg font-medium text-blue-900 mb-4">
                        Создать новое мероприятие
                      </h3>
                      <form onSubmit={handleCreateEvent} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Название группы мероприятий *
                            </label>
                            <input
                              type="text"
                              value={createFormData.eventum_name}
                              onChange={(e) => setCreateFormData(prev => ({ ...prev, eventum_name: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Название мероприятия *
                            </label>
                            <input
                              type="text"
                              value={createFormData.event_name}
                              onChange={(e) => setCreateFormData(prev => ({ ...prev, event_name: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Описание мероприятия
                          </label>
                          <textarea
                            value={createFormData.event_description}
                            onChange={(e) => setCreateFormData(prev => ({ ...prev, event_description: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={3}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Время начала *
                            </label>
                            <input
                              type="datetime-local"
                              value={createFormData.start_time}
                              onChange={(e) => setCreateFormData(prev => ({ ...prev, start_time: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Время окончания *
                            </label>
                            <input
                              type="datetime-local"
                              value={createFormData.end_time}
                              onChange={(e) => setCreateFormData(prev => ({ ...prev, end_time: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                        </div>
                        <div className="flex space-x-3">
                          <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                          >
                            Создать
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowCreateForm(false)}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                          >
                            Отмена
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Events List */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Ваши мероприятия ({events.length})
                    </h3>
                    
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-2 text-gray-600">Загрузка мероприятий...</p>
                      </div>
                    ) : events.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <p className="text-gray-600">У вас пока нет мероприятий</p>
                        <p className="text-sm text-gray-500 mt-1">Создайте первое мероприятие, нажав кнопку выше</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {events.map((event) => {
                          const eventStatus = getEventStatus(event);
                          return (
                            <div key={event.id} className={`border rounded-lg p-4 ${eventStatus.bg}`}>
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h4 className="text-lg font-medium text-gray-900">
                                      {event.name}
                                    </h4>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${eventStatus.color} ${eventStatus.bg}`}>
                                      {eventStatus.status === 'upcoming' && 'Предстоящее'}
                                      {eventStatus.status === 'ongoing' && 'Идет сейчас'}
                                      {eventStatus.status === 'past' && 'Завершено'}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      event.user_role === 'organizer' 
                                        ? 'bg-purple-100 text-purple-800' 
                                        : 'bg-green-100 text-green-800'
                                    }`}>
                                      {event.user_role === 'organizer' ? 'Организатор' : 'Участник'}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-2">
                                    {event.eventum_name}
                                  </p>
                                  {event.description && (
                                    <p className="text-sm text-gray-700 mb-2">
                                      {event.description}
                                    </p>
                                  )}
                                  <div className="text-sm text-gray-500">
                                    <p>Начало: {formatDateTime(event.start_time)}</p>
                                    <p>Окончание: {formatDateTime(event.end_time)}</p>
                                  </div>
                                </div>
                                <div className="flex space-x-2 ml-4">
                                  <button
                                    onClick={() => window.location.href = `/eventum/${event.eventum_slug}`}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                                  >
                                    Перейти к мероприятию
                                  </button>
                                  {event.user_role === 'organizer' && (
                                    <button
                                      onClick={() => window.location.href = `/admin/eventum/${event.eventum_slug}`}
                                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition-colors"
                                    >
                                      Админка
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
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

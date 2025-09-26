import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();

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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Личный кабинет
              </h2>
              
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

                  {/* Placeholder for future features */}
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-blue-900 mb-2">
                      Добро пожаловать в Eventum!
                    </h3>
                    <p className="text-blue-700">
                      Здесь будут отображаться ваши мероприятия, роли и другие функции.
                      Пока что это пустой кабинет для демонстрации авторизации.
                    </p>
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

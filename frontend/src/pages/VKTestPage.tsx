import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

const VKTestPage: React.FC = () => {
  const [vkSettings, setVkSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVKSettings = async () => {
      try {
        const response = await apiClient.get('/auth/vk-settings/');
        setVkSettings(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка загрузки настроек VK');
      } finally {
        setLoading(false);
      }
    };

    fetchVKSettings();
  }, []);

  if (loading) {
    return <div>Загрузка...</div>;
  }

  if (error) {
    return <div className="text-red-600">Ошибка: {error}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Настройки VK для отладки</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Текущие настройки на сервере:</h2>
        <div className="space-y-2">
          <div>
            <strong>VK_APP_ID:</strong> {vkSettings?.VK_APP_ID || 'Не установлен'}
          </div>
          <div>
            <strong>VK_REDIRECT_URI:</strong> {vkSettings?.VK_REDIRECT_URI || 'Не установлен'}
          </div>
          <div>
            <strong>VK_APP_SECRET:</strong> {vkSettings?.VK_APP_SECRET ? 'Установлен' : 'Не установлен'}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Настройки на фронтенде:</h2>
        <div className="space-y-2">
          <div>
            <strong>VK App ID:</strong> 54178494
          </div>
          <div>
            <strong>Redirect URL:</strong> https://eventum-web-ui.vercel.app
          </div>
        </div>
      </div>

      <div className="mt-6 bg-yellow-50 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Проверьте в настройках VK App:</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Зайдите в <a href="https://vk.com/apps?act=manage" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">управление приложениями VK</a></li>
          <li>Найдите приложение с ID: 54178494</li>
          <li>В разделе "Настройки" проверьте "Базовый домен" и "Адрес сайта"</li>
          <li>Убедитесь, что "Базовый домен" содержит: eventum-web-ui.vercel.app</li>
          <li>В разделе "VK ID" проверьте "Redirect URI" - должен быть: https://eventum-web-ui.vercel.app</li>
        </ul>
      </div>

      <div className="mt-6 bg-red-50 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Возможные проблемы:</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Несоответствие redirect_uri между фронтендом и настройками VK App</li>
          <li>Неправильный VK_APP_ID или VK_APP_SECRET на сервере</li>
          <li>VK App не активирован или заблокирован</li>
          <li>Неправильные настройки CORS</li>
        </ul>
      </div>
    </div>
  );
};

export default VKTestPage;

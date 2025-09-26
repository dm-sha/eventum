import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api/auth';
import LoadingSpinner from './LoadingSpinner';

declare global {
  interface Window {
    VKIDSDK: any;
  }
}

const VKAuth: React.FC = () => {
  const { login } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    const vkidOnSuccess = async (data: any) => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await authApi.vkAuth({ code: data.code });
        login(response, response.user);
        
      } catch (err: any) {
        setError(err.response?.data?.error || 'Ошибка авторизации');
      } finally {
        setIsLoading(false);
      }
    };

    const vkidOnError = () => {
      setError('Ошибка авторизации через VK');
      setIsLoading(false);
    };

    // Проверяем, не загружен ли уже VK SDK
    if (window.VKIDSDK) {
      initVKAuth();
      return;
    }

    // Загружаем VK SDK
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@vkid/sdk@<3.0.0/dist-sdk/umd/index.js';
    script.onload = initVKAuth;
    script.onerror = () => {
      setError('Не удалось загрузить VK SDK');
    };
    document.head.appendChild(script);

    function initVKAuth() {
      if ('VKIDSDK' in window) {
        const VKID = window.VKIDSDK;

        VKID.Config.init({
          app: 54178494,
          redirectUrl: 'https://eventum-web-ui.vercel.app',
          responseMode: VKID.ConfigResponseMode.Callback,
          source: VKID.ConfigSource.LOWCODE,
          scope: '',
        });

        // Очищаем контейнер
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        const oneTap = new VKID.OneTap();

        oneTap.render({
          container: containerRef.current,
          showAlternativeLogin: true
        })
        .on(VKID.WidgetEvents.ERROR, vkidOnError)
        .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, function (payload: any) {
          const code = payload.code;
          const deviceId = payload.device_id;

          // Обмениваем код на токены на фронтенде
          VKID.Auth.exchangeCode(code, deviceId)
            .then((result: any) => {
              // Если обмен прошел успешно, отправляем access_token на бэкенд
              if (result && result.access_token) {
                vkidOnSuccess({ code: result.access_token });
              } else {
                // Если обмен не сработал, отправляем исходный код
                vkidOnSuccess({ code });
              }
            })
            .catch(() => {
              // Если обмен не сработал, отправляем исходный код
              vkidOnSuccess({ code });
            });
        });
      }
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [login]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <LoadingSpinner />
        <p className="mt-4 text-gray-600">Авторизация через VK...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Eventum</h1>
          <p className="text-gray-600">Войдите через VK для продолжения</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* VK SDK будет рендерить кнопку в этот контейнер */}
        <div ref={containerRef} className="w-full flex justify-center" />
      </div>
    </div>
  );
};

export default VKAuth;

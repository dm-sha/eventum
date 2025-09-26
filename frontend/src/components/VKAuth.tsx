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
        
        console.log('VK Auth success data:', data);
        console.log('Access token:', data.access_token);
        console.log('Refresh token:', data.refresh_token);
        console.log('ID token:', data.id_token);
        
        // Отправляем код на бэкенд для обмена на токены
        const response = await authApi.vkAuth({ code: data.code });
        console.log('Backend response:', response);
        login(response, response.user);
        
      } catch (err: any) {
        console.error('VK Auth error:', err);
        console.error('Error response:', err.response?.data);
        setError(err.response?.data?.error || 'Ошибка авторизации');
      } finally {
        setIsLoading(false);
      }
    };

    const vkidOnError = (error: any) => {
      console.error('VK Auth error:', error);
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

          console.log('VK ID payload:', payload);
          console.log('Code:', code);
          console.log('Device ID:', deviceId);

          // Пробуем обменять код на токены на фронтенде
          console.log('Trying VKID.Auth.exchangeCode...');
          VKID.Auth.exchangeCode(code, deviceId)
            .then((result: any) => {
              console.log('VKID.Auth.exchangeCode SUCCESS:', result);
              console.log('Result type:', typeof result);
              console.log('Result keys:', Object.keys(result || {}));
              
              // Проверяем разные возможные форматы ответа
              if (result && typeof result === 'object') {
                if (result.access_token) {
                  console.log('Found access_token, sending to backend');
                  vkidOnSuccess({ code: result.access_token });
                } else if (result.code) {
                  console.log('Found code in result, sending to backend');
                  vkidOnSuccess({ code: result.code });
                } else {
                  console.log('No access_token or code found, sending original code');
                  vkidOnSuccess({ code });
                }
              } else {
                console.log('Result is not an object, sending original code');
                vkidOnSuccess({ code });
              }
            })
            .catch((error: any) => {
              console.error('VKID.Auth.exchangeCode ERROR:', error);
              console.log('Sending original code to backend');
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

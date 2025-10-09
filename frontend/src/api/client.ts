import axios, { type AxiosResponse, type AxiosError } from 'axios';
import { getCookie, setCookie, deleteCookie, getMerupCookieOptions } from '../utils/cookies';
import { resolveApiBaseUrl } from './baseUrl';
import { getSubdomainSlug } from '../utils/eventumSlug';

const apiClient = axios.create({
    baseURL: resolveApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

// Интерцептор для добавления токена аутентификации
apiClient.interceptors.request.use(
    (config) => {
        // Пропускаем добавление токенов для эндпоинтов аутентификации и календаря
        const isAuthEndpoint = config.url?.includes('/auth/vk/') || 
                              config.url?.includes('/auth/refresh/') ||
                              config.url?.includes('/auth/dev-user/');
        
        const isCalendarEndpoint = config.url?.includes('/calendar/') || 
                                  config.url?.includes('/calendar.ics') ||
                                  config.url?.includes('/calendar/webcal');
        
        if (isAuthEndpoint || isCalendarEndpoint) {
            return config;
        }
        
        let tokens = null;
        const userAgent = navigator.userAgent;
        const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
        
        // 1. Сначала пробуем получить из localStorage (для локальной разработки)
        tokens = localStorage.getItem('auth_tokens');
        
        // 2. Если на поддомене merup.ru и нет данных в localStorage, пробуем cookies
        const hostname = window.location.hostname;
        const isMerupDomain = hostname === 'merup.ru' || hostname.endsWith('.merup.ru');
        if (!tokens && isMerupDomain) {
            tokens = getCookie('auth_tokens');
        }
        
        // 3. Fallback для мобильных устройств: пробуем sessionStorage
        if (!tokens) {
            tokens = sessionStorage.getItem('auth_tokens');
        }
        
        // 4. Специальная логика для Safari: пробуем все доступные источники
        if (!tokens && isSafari) {
            // Пробуем все возможные источники токенов
            const tokenSources = [
                () => localStorage.getItem('auth_tokens'),
                () => sessionStorage.getItem('auth_tokens'),
                () => getCookie('auth_tokens'),
                () => getCookie('auth_tokens_alt'), // альтернативное имя cookie
            ];
            
            for (const getToken of tokenSources) {
                try {
                    const token = getToken();
                    if (token) {
                        tokens = token;
                        break;
                    }
                } catch (e) {
                    // Игнорируем ошибки при получении токенов
                }
            }
        }
        
        if (tokens) {
            try {
                // Валидация JSON перед парсингом
                const trimmedTokens = tokens.trim();
                if (!trimmedTokens || trimmedTokens.length < 10) {
                    tokens = null;
                } else {
                    const { access } = JSON.parse(trimmedTokens);
                    if (!access || typeof access !== 'string') {
                        tokens = null;
                    } else {
                        // Всегда используем query параметры для передачи токена
                        config.params = {
                            ...config.params,
                            access_token: access
                        };
                    }
                }
            } catch (error) {
                console.error('Error parsing auth tokens:', error);
                
                // Очищаем поврежденные данные
                if (isSafari) {
                    try {
                        localStorage.removeItem('auth_tokens');
                        sessionStorage.removeItem('auth_tokens');
                        deleteCookie('auth_tokens');
                        deleteCookie('auth_tokens_alt');
                    } catch (e) {
                        // Игнорируем ошибки при очистке
                    }
                }
                tokens = null;
            }
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Интерцептор для обработки ошибок аутентификации
apiClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as any;
        const userAgent = navigator.userAgent;
        const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);


        if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                let tokens = null;
                
                // 1. Сначала пробуем получить из localStorage (для локальной разработки)
                tokens = localStorage.getItem('auth_tokens');
                
                // 2. Если на поддомене merup.ru и нет данных в localStorage, пробуем cookies
                if (!tokens && window.location.hostname.includes('merup.ru')) {
                    tokens = getCookie('auth_tokens');
                }
                
                // 3. Fallback для мобильных устройств: пробуем sessionStorage
                if (!tokens) {
                    tokens = sessionStorage.getItem('auth_tokens');
                }
                
                if (tokens) {
                    const { refresh } = JSON.parse(tokens);

                    // Пытаемся обновить токен
                    const response = await axios.post(`${resolveApiBaseUrl()}/auth/refresh/`, {
                        refresh
                    });

                    const { access } = response.data;
                    const newTokens = { access, refresh };
                    
                    // Сохраняем в localStorage для локальной разработки
                    localStorage.setItem('auth_tokens', JSON.stringify(newTokens));
                    
                    // Сохраняем в sessionStorage для мобильных устройств
                    sessionStorage.setItem('auth_tokens', JSON.stringify(newTokens));
                    
                    // Сохраняем в cookies для работы с поддоменами
                    const cookieOptions = getMerupCookieOptions();
                    setCookie('auth_tokens', JSON.stringify(newTokens), cookieOptions);
                    
                    // Для Safari дополнительно сохраняем в альтернативном cookie
                    if (isSafari) {
                        try {
                            setCookie('auth_tokens_alt', JSON.stringify(newTokens), {
                                ...cookieOptions,
                                samesite: 'lax' // Используем lax для альтернативного cookie
                            });
                        } catch (e) {
                            // Игнорируем ошибки при сохранении альтернативного cookie
                        }
                    }
                    
                    // Повторяем оригинальный запрос с новым токеном
                    // Всегда используем query параметры для передачи токена
                    originalRequest.params = {
                        ...originalRequest.params,
                        access_token: access
                    };
                    return apiClient(originalRequest);
                }
            } catch (refreshError) {
                console.error('Ошибка обновления токена:', refreshError);
                // Если не удалось обновить токен, очищаем данные аутентификации
                localStorage.removeItem('auth_tokens');
                localStorage.removeItem('auth_user');
                sessionStorage.removeItem('auth_tokens');
                sessionStorage.removeItem('auth_user');
                
                // Очищаем cookies
                const cookieOptions = getMerupCookieOptions();
                deleteCookie('auth_tokens', cookieOptions);
                deleteCookie('auth_user', cookieOptions);
                
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);


// Функция для создания API клиента с учетом поддомена
export const createEventumApiClient = (slug: string) => {
  const baseURL = resolveApiBaseUrl();
  const subdomainSlug = getSubdomainSlug();
  
  // Если мы на поддомене, не добавляем slug в базовый URL
  const eventumBaseUrl = subdomainSlug ? baseURL : `${baseURL}/eventums/${slug}`;
  
  return axios.create({
    baseURL: eventumBaseUrl,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export { apiClient };
export default apiClient;

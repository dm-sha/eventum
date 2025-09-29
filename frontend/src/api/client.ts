import axios, { type AxiosResponse, type AxiosError } from 'axios';
import { getCookie, setCookie, deleteCookie, getMerupCookieOptions } from '../utils/cookies';

// Определяем базовый URL API в зависимости от окружения
const getApiBaseUrl = () => {
    // В режиме разработки используем локальный бекенд
    if (import.meta.env.DEV) {
        return 'http://localhost:8000/api';
    }
    // В продакшене используем переменную окружения или fallback на продакшн URL
    return import.meta.env.VITE_API_BASE_URL || 'https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api';
};

const apiClient = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

// Интерцептор для добавления токена аутентификации
apiClient.interceptors.request.use(
    (config) => {
        let tokens = null;
        const userAgent = navigator.userAgent;
        const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
        
        console.log(`[API Client] Browser: ${isSafari ? 'Safari' : 'Other'}, URL: ${config.url}`);
        
        // 1. Сначала пробуем получить из localStorage (для локальной разработки)
        tokens = localStorage.getItem('auth_tokens');
        console.log(`[API Client] localStorage tokens:`, tokens ? 'found' : 'not found');
        
        // 2. Если на поддомене merup.ru и нет данных в localStorage, пробуем cookies
        if (!tokens && window.location.hostname.includes('merup.ru')) {
            tokens = getCookie('auth_tokens');
            console.log(`[API Client] Cookie tokens:`, tokens ? 'found' : 'not found');
        }
        
        // 3. Fallback для мобильных устройств: пробуем sessionStorage
        if (!tokens) {
            tokens = sessionStorage.getItem('auth_tokens');
            console.log(`[API Client] sessionStorage tokens:`, tokens ? 'found' : 'not found');
        }
        
        // 4. Специальная логика для Safari: пробуем все доступные источники
        if (!tokens && isSafari) {
            console.log(`[API Client] Safari detected, trying all token sources...`);
            
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
                        console.log(`[API Client] Safari: Found token in ${getToken.name || 'source'}`);
                        break;
                    }
                } catch (e) {
                    console.log(`[API Client] Safari: Error getting token from ${getToken.name || 'source'}:`, e);
                }
            }
        }
        
        if (tokens) {
            try {
                const { access } = JSON.parse(tokens);
                console.log(`[API Client] Access token found, length: ${access?.length || 0}`);
                
                // Всегда используем query параметры для передачи токена
                config.params = {
                    ...config.params,
                    access_token: access
                };
                
                console.log(`[API Client] Request params:`, config.params);
            } catch (error) {
                console.error('Error parsing auth tokens:', error);
            }
        } else {
            console.warn(`[API Client] No tokens found for request to ${config.url}`);
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
                    const response = await axios.post(`${getApiBaseUrl()}/auth/refresh/`, {
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
                        console.log(`[API Client] Safari: Saving tokens in multiple locations`);
                        try {
                            setCookie('auth_tokens_alt', JSON.stringify(newTokens), {
                                ...cookieOptions,
                                samesite: 'lax' // Используем lax для альтернативного cookie
                            });
                        } catch (e) {
                            console.warn(`[API Client] Safari: Failed to set alternative cookie:`, e);
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


export { apiClient };
export default apiClient;

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
        // Сначала пробуем получить из localStorage (для локальной разработки)
        let tokens = localStorage.getItem('auth_tokens');
        
        // Если на поддомене merup.ru и нет данных в localStorage, пробуем cookies
        if (!tokens && window.location.hostname.includes('merup.ru')) {
          tokens = getCookie('auth_tokens');
        }
        
        if (tokens) {
            try {
                const { access } = JSON.parse(tokens);
                
                // Всегда используем query параметры для передачи токена
                config.params = {
                    ...config.params,
                    access_token: access
                };
            } catch (error) {
                console.error('Error parsing auth tokens:', error);
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


        if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Сначала пробуем получить из localStorage (для локальной разработки)
                let tokens = localStorage.getItem('auth_tokens');
                
                // Если на поддомене merup.ru и нет данных в localStorage, пробуем cookies
                if (!tokens && window.location.hostname.includes('merup.ru')) {
                  tokens = getCookie('auth_tokens');
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
                    
                    // Сохраняем в cookies для работы с поддоменами
                    const cookieOptions = getMerupCookieOptions();
                    setCookie('auth_tokens', JSON.stringify(newTokens), cookieOptions);
                    
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

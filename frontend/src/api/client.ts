import axios, { type AxiosResponse, type AxiosError } from 'axios';

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

// Интерцептор для добавления токена аутентификации через query параметры
apiClient.interceptors.request.use(
    (config) => {
        const tokens = localStorage.getItem('auth_tokens');
        console.log('API Request interceptor - tokens from localStorage:', tokens);
        if (tokens) {
            try {
                const { access } = JSON.parse(tokens);
                
                // Передаем токен только через query параметры (работает!)
                config.params = {
                    ...config.params,
                    access_token: access
                };
                console.log('Access token added to query params:', access.substring(0, 20) + '...');
                
            } catch (error) {
                console.error('Error parsing auth tokens:', error);
            }
        } else {
            console.log('No tokens found in localStorage');
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

        // Логируем ошибку для отладки
        console.error('API Error:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            url: originalRequest?.url,
            method: originalRequest?.method,
            headers: originalRequest?.headers,
            data: error.response?.data
        });

        if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const tokens = localStorage.getItem('auth_tokens');
                if (tokens) {
                    const { refresh } = JSON.parse(tokens);
                    
                    console.log('Пытаемся обновить токен...');
                    
                    // Пытаемся обновить токен
                    const response = await axios.post(`${getApiBaseUrl()}/auth/refresh/`, {
                        refresh
                    });

                    const { access } = response.data;
                    const newTokens = { access, refresh };
                    
                    localStorage.setItem('auth_tokens', JSON.stringify(newTokens));
                    
                    console.log('Токен обновлен, повторяем запрос...');
                    
                    // Повторяем оригинальный запрос с новым токеном через query параметр
                    originalRequest.params = {
                        ...originalRequest.params,
                        access_token: access
                    };
                    return apiClient(originalRequest);
                } else {
                    console.log('Нет токенов для обновления');
                }
            } catch (refreshError) {
                console.error('Ошибка обновления токена:', refreshError);
                // Если не удалось обновить токен, очищаем данные аутентификации
                localStorage.removeItem('auth_tokens');
                localStorage.removeItem('auth_user');
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export { apiClient };
export default apiClient;

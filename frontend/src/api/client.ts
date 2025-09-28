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

// Интерцептор для добавления токена аутентификации
apiClient.interceptors.request.use(
    (config) => {
        console.log('API Request Interceptor:', {
            url: config.url,
            baseURL: config.baseURL,
            fullURL: `${config.baseURL}${config.url}`,
            currentParams: config.params
        });
        
        const tokens = localStorage.getItem('auth_tokens');
        console.log('Tokens from localStorage:', tokens);
        
        if (tokens) {
            try {
                const { access } = JSON.parse(tokens);
                console.log('Access token found:', access ? 'YES' : 'NO');
                
                // Всегда используем query параметры для передачи токена
                config.params = {
                    ...config.params,
                    access_token: access
                };
                
                console.log('Updated params:', config.params);
            } catch (error) {
                console.error('Error parsing auth tokens:', error);
            }
        } else {
            console.log('No tokens found in localStorage');
        }
        
        console.log('Final config:', {
            url: config.url,
            params: config.params,
            fullURL: `${config.baseURL}${config.url}?${new URLSearchParams(config.params).toString()}`
        });
        
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
                const tokens = localStorage.getItem('auth_tokens');
                if (tokens) {
                    const { refresh } = JSON.parse(tokens);
                    
                    // Пытаемся обновить токен
                    const response = await axios.post(`${getApiBaseUrl()}/auth/refresh/`, {
                        refresh
                    });

                    const { access } = response.data;
                    const newTokens = { access, refresh };
                    
                    localStorage.setItem('auth_tokens', JSON.stringify(newTokens));
                    
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
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

// Тестовая функция для проверки интерцептора
export const testApiCall = async () => {
    console.log('Testing API call...');
    try {
        const response = await apiClient.get('/auth/profile/');
        console.log('Test API response:', response);
        return response;
    } catch (error) {
        console.error('Test API error:', error);
        throw error;
    }
};

// Добавляем функцию в window для тестирования из консоли браузера
if (typeof window !== 'undefined') {
    (window as any).testApiCall = testApiCall;
    (window as any).apiClient = apiClient;
}

export { apiClient };
export default apiClient;

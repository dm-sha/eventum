/**
 * Улучшенный API клиент с упрощенной логикой
 */
import axios, { type AxiosResponse, type AxiosError, type AxiosRequestConfig } from 'axios';
import { getCookie, setCookie, deleteCookie, getMerupCookieOptions } from '../utils/cookies';

// Определяем базовый URL API
const getApiBaseUrl = (): string => {
  if (import.meta.env.DEV) {
    return 'http://localhost:8000/api';
  }
  return import.meta.env.VITE_API_BASE_URL || 'https://bbapo5ibqs4eg6dail89.containers.yandexcloud.net/api';
};

// Утилиты для работы с токенами
class TokenManager {
  private static getStorageKey(key: string): string {
    return `auth_${key}`;
  }

  static getTokens(): { access: string; refresh: string } | null {
    // Пробуем получить токены из разных источников
    const sources = [
      () => localStorage.getItem(this.getStorageKey('tokens')),
      () => sessionStorage.getItem(this.getStorageKey('tokens')),
      () => getCookie(this.getStorageKey('tokens')),
    ];

    for (const getToken of sources) {
      try {
        const tokens = getToken();
        if (tokens) {
          const parsed = JSON.parse(tokens);
          if (parsed.access && parsed.refresh) {
            return parsed;
          }
        }
      } catch (error) {
        // Игнорируем ошибки парсинга
      }
    }

    return null;
  }

  static saveTokens(tokens: { access: string; refresh: string }): void {
    const tokenString = JSON.stringify(tokens);
    
    // Сохраняем во все доступные хранилища
    localStorage.setItem(this.getStorageKey('tokens'), tokenString);
    sessionStorage.setItem(this.getStorageKey('tokens'), tokenString);
    
    // Сохраняем в cookies для поддоменов
    const cookieOptions = getMerupCookieOptions();
    setCookie(this.getStorageKey('tokens'), tokenString, cookieOptions);
  }

  static clearTokens(): void {
    localStorage.removeItem(this.getStorageKey('tokens'));
    localStorage.removeItem(this.getStorageKey('user'));
    sessionStorage.removeItem(this.getStorageKey('tokens'));
    sessionStorage.removeItem(this.getStorageKey('user'));
    
    const cookieOptions = getMerupCookieOptions();
    deleteCookie(this.getStorageKey('tokens'), cookieOptions);
    deleteCookie(this.getStorageKey('user'), cookieOptions);
  }
}

// Создаем основной API клиент
const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор для добавления токена
apiClient.interceptors.request.use(
  (config) => {
    const tokens = TokenManager.getTokens();
    if (tokens?.access) {
      // Используем Authorization header как основной способ
      config.headers.Authorization = `Bearer ${tokens.access}`;
      
      // Добавляем query параметр как fallback для совместимости
      config.params = {
        ...config.params,
        access_token: tokens.access
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Интерцептор для обработки ошибок и обновления токенов
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const tokens = TokenManager.getTokens();
      if (tokens?.refresh) {
        try {
          const response = await axios.post(`${getApiBaseUrl()}/auth/refresh/`, {
            refresh: tokens.refresh
          });

          const newTokens = {
            access: response.data.access,
            refresh: tokens.refresh
          };

          TokenManager.saveTokens(newTokens);

          // Повторяем оригинальный запрос с новым токеном
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newTokens.access}`;
          }
          if (originalRequest.params) {
            originalRequest.params.access_token = newTokens.access;
          }

          return apiClient(originalRequest);
        } catch (refreshError) {
          TokenManager.clearTokens();
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// Функция для создания URL с учетом поддоменов
export const createApiUrl = (path: string, eventumSlug?: string): string => {
  const baseUrl = getApiBaseUrl();

  if (eventumSlug) {
    return `${baseUrl}/eventums/${eventumSlug}${path}`;
  }

  return `${baseUrl}${path}`;
};

// Универсальная функция для API запросов с автоматическим определением URL
export const createApiRequest = <T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  eventumSlug?: string,
  data?: any
) => {
  const url = createApiUrl(path, eventumSlug);
  
  switch (method) {
    case 'GET':
      return apiClient.get<T>(url);
    case 'POST':
      return apiClient.post<T>(url, data);
    case 'PUT':
      return apiClient.put<T>(url, data);
    case 'PATCH':
      return apiClient.patch<T>(url, data);
    case 'DELETE':
      return apiClient.delete<T>(url);
    default:
      throw new Error(`Unsupported method: ${method}`);
  }
};

export { apiClient, TokenManager };
export default apiClient;

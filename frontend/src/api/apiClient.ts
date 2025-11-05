/**
 * Улучшенный API клиент с упрощенной логикой
 */
import axios, { type AxiosResponse, type AxiosError, type AxiosRequestConfig } from 'axios';
import { getCookie, setCookie, deleteCookie, getMerupCookieOptions } from '../utils/cookies';
import { resolveApiBaseUrl } from './baseUrl';

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
  baseURL: resolveApiBaseUrl(),
  // Не задаем глобально Content-Type, чтобы FormData могло корректно выставлять boundary
});

// Интерцептор для добавления токена
apiClient.interceptors.request.use(
  (config) => {
    // Пропускаем добавление токенов для эндпоинтов аутентификации
    const isAuthEndpoint = config.url?.includes('/auth/vk/') ||
                          config.url?.includes('/auth/refresh/') ||
                          config.url?.includes('/auth/dev-user/');
    const isCalendarEndpoint = config.url?.includes('/calendar/') ||
                               config.url?.includes('/calendar.ics') ||
                               config.url?.includes('/calendar/webcal');

    if (!isAuthEndpoint && !isCalendarEndpoint) {
      const tokens = TokenManager.getTokens();
      if (tokens?.access) {
        // Используем только query параметр для передачи токена
        config.params = {
          ...config.params,
          access_token: tokens.access
        };
      }
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
          const response = await axios.post(`${resolveApiBaseUrl()}/auth/refresh/`, {
            refresh: tokens.refresh
          });

          const { access, refresh: rotatedRefresh } = response.data as { access: string; refresh?: string };
          const newTokens = {
            access,
            refresh: rotatedRefresh ?? tokens.refresh
          };

          TokenManager.saveTokens(newTokens);

          // Повторяем оригинальный запрос с новым токеном (только query параметр)
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
  const baseUrl = resolveApiBaseUrl();

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
      if (typeof FormData !== 'undefined' && data instanceof FormData) {
        return apiClient.post<T>(url, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      return apiClient.post<T>(url, data, {
        headers: { 'Content-Type': 'application/json' }
      });
    case 'PUT':
      if (typeof FormData !== 'undefined' && data instanceof FormData) {
        return apiClient.put<T>(url, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      return apiClient.put<T>(url, data, {
        headers: { 'Content-Type': 'application/json' }
      });
    case 'PATCH':
      if (typeof FormData !== 'undefined' && data instanceof FormData) {
        return apiClient.patch<T>(url, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      return apiClient.patch<T>(url, data, {
        headers: { 'Content-Type': 'application/json' }
      });
    case 'DELETE':
      return apiClient.delete<T>(url);
    default:
      throw new Error(`Unsupported method: ${method}`);
  }
};

export { apiClient, TokenManager };
export default apiClient;

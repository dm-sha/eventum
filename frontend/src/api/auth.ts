import { apiClient } from './client';
import type { User } from '../contexts/AuthContext';

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface VKAuthRequest {
  code: string;
  state?: string;
}

export interface VKAuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RefreshTokenRequest {
  refresh: string;
}

export interface RefreshTokenResponse {
  access: string;
}

export const authApi = {
  // Авторизация через VK
  vkAuth: async (data: VKAuthRequest): Promise<VKAuthResponse> => {
    const response = await apiClient.post('/auth/vk/', data);
    return response.data;
  },

  // Обновление токена
  refreshToken: async (data: RefreshTokenRequest): Promise<RefreshTokenResponse> => {
    const response = await apiClient.post('/auth/refresh/', data);
    return response.data;
  },

  // Получение профиля пользователя
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get('/auth/profile/');
    return response.data;
  },

  // Получение ролей пользователя
  getUserRoles: async () => {
    const response = await apiClient.get('/auth/roles/');
    return response.data;
  }
};

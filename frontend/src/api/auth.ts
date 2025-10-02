/**
 * @deprecated Используйте authApi из eventumApi.ts
 * Этот файл оставлен для обратной совместимости
 */
import { authApi as newAuthApi } from './eventumApi';
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

// Экспортируем новый API для обратной совместимости
export const authApi = {
  vkAuth: async (data: VKAuthRequest): Promise<VKAuthResponse> => {
    const response = await newAuthApi.vkAuth(data);
    return response.data;
  },

  refreshToken: async (data: RefreshTokenRequest): Promise<RefreshTokenResponse> => {
    const response = await newAuthApi.refreshToken(data);
    return response.data;
  },

  getProfile: async (): Promise<User> => {
    const response = await newAuthApi.getProfile();
    return response.data;
  },

  getUserRoles: async () => {
    const response = await newAuthApi.getRoles();
    return response.data;
  }
};

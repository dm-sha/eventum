import apiClient from './client';
import type { LoginPayload, RefreshResponse, RegisterPayload, UserResponse } from '../types';

export const login = async (payload: LoginPayload): Promise<UserResponse> => {
  const response = await apiClient.post<UserResponse>('/auth/login/', payload);
  return response.data;
};

export const refreshToken = async (refresh: string): Promise<RefreshResponse> => {
  const response = await apiClient.post<RefreshResponse>('/auth/token/refresh/', { refresh });
  return response.data;
};

export const register = async (payload: RegisterPayload): Promise<void> => {
  await apiClient.post('/auth/register/', payload);
};

export const fetchCurrentUser = async (): Promise<UserResponse['user']> => {
  const response = await apiClient.get<UserResponse['user']>('/auth/me/');
  return response.data;
};

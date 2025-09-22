import apiClient from './client';
import type { CreateEventumPayload, DashboardEventum } from '../types';

export const getMyEventums = async (): Promise<DashboardEventum[]> => {
  const response = await apiClient.get<DashboardEventum[]>('/dashboard/eventums/');
  return response.data;
};

export const createEventum = async (
  payload: CreateEventumPayload,
): Promise<DashboardEventum> => {
  const response = await apiClient.post<DashboardEventum>('/dashboard/eventums/', payload);
  return response.data;
};

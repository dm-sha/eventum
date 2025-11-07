import apiClient from './client';
import { shouldUseSubdomainApi, shouldUseContainerApi } from '../utils/eventumSlug';

export interface EventRegistration {
  id: number;
  event: {
    id: number;
    name: string;
    description: string;
    start_time: string;
    end_time: string;
  };
  registration_type: 'button' | 'application';
  max_participants: number | null;
  allowed_group: number | null;
  registered_count: number;
  is_full: boolean;
  event_participants_count?: number; // Количество участников мероприятия (связанных через группы v2)
  applicants?: number[]; // IDs участников для типа application
}

export interface CreateEventRegistrationDto {
  event_id: number;
  registration_type: 'button' | 'application';
  max_participants?: number | null;
  allowed_group?: number | null;
}

export interface UpdateEventRegistrationDto {
  event_id?: number;
  registration_type?: 'button' | 'application';
  max_participants?: number | null;
  allowed_group?: number | null;
}

export async function listEventRegistrations(eventumSlug: string): Promise<EventRegistration[]> {
  if (shouldUseSubdomainApi()) {
    const { data } = await apiClient.get('/event-registrations/');
    return data;
  } else if (shouldUseContainerApi()) {
    const { data } = await apiClient.get(`/eventums/${eventumSlug}/event-registrations/`);
    return data;
  } else {
    const { data } = await apiClient.get(`/eventums/${eventumSlug}/event-registrations/`);
    return data;
  }
}

export async function createEventRegistration(eventumSlug: string, dto: CreateEventRegistrationDto): Promise<EventRegistration> {
  if (shouldUseSubdomainApi()) {
    const { data } = await apiClient.post('/event-registrations/', dto);
    return data;
  } else if (shouldUseContainerApi()) {
    const { data } = await apiClient.post(`/eventums/${eventumSlug}/event-registrations/`, dto);
    return data;
  } else {
    const { data } = await apiClient.post(`/eventums/${eventumSlug}/event-registrations/`, dto);
    return data;
  }
}

export async function updateEventRegistration(eventumSlug: string, id: number, dto: UpdateEventRegistrationDto): Promise<EventRegistration> {
  if (shouldUseSubdomainApi()) {
    const { data } = await apiClient.patch(`/event-registrations/${id}/`, dto);
    return data;
  } else if (shouldUseContainerApi()) {
    const { data } = await apiClient.patch(`/eventums/${eventumSlug}/event-registrations/${id}/`, dto);
    return data;
  } else {
    const { data } = await apiClient.patch(`/eventums/${eventumSlug}/event-registrations/${id}/`, dto);
    return data;
  }
}

export async function deleteEventRegistration(eventumSlug: string, id: number): Promise<void> {
  if (shouldUseSubdomainApi()) {
    await apiClient.delete(`/event-registrations/${id}/`);
  } else if (shouldUseContainerApi()) {
    await apiClient.delete(`/eventums/${eventumSlug}/event-registrations/${id}/`);
  } else {
    await apiClient.delete(`/eventums/${eventumSlug}/event-registrations/${id}/`);
  }
}


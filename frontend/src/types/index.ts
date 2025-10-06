export interface Eventum {
    id: number;
    name: string;
    slug: string;
    description?: string;
    image_url?: string;
    registration_open: boolean;
    // password_hash мы не получаем на фронтенде, поэтому его здесь нет
}

export interface User {
  id: number;
  vk_id: number;
  name: string;
  avatar_url: string;
  email: string;
  date_joined: string;
  last_login: string;
}

export interface Participant {
  id: number;
  name: string;
  user?: User;
  user_id?: number | null;
  eventum: number; // ID of the eventum
  groups?: ParticipantGroup[];
}

export interface GroupTag {
  id: number;
  name: string;
  slug: string;
}

export interface EventTag {
  id: number;
  name: string;
  slug: string;
}

export interface ParticipantGroup {
  id: number;
  name: string;
  slug: string;
  participants: number[];
  tags: GroupTag[];
}

export type ParticipantType = 'all' | 'registration' | 'manual';

export interface Event {
  id: number;
  name: string;
  description: string;
  start_time: string; // ISO 8601 string date
  end_time: string;   // ISO 8601 string date
  eventum: number;    // ID of the eventum
  locations?: Location[]; // Локации проведения мероприятия (many-to-many)
  location_ids?: number[]; // ID локаций для записи (many-to-many)
  participant_type: ParticipantType; // Тип определения участников
  max_participants?: number; // Максимальное количество участников (для типа registration)
  image_url?: string; // URL изображения события
  registrations_count: number; // Количество записанных участников
  is_registered: boolean; // Записан ли текущий пользователь
  // (arrays of IDs)
  participants: number[];
  groups: number[];
  tags: EventTag[]; // Объекты тегов для чтения
  group_tags: GroupTag[]; // Объекты тегов групп для чтения
}

export interface UserEvent extends Event {
  user_role: 'organizer' | 'participant' | null;
  eventum_name: string;
  eventum_slug: string;
}

export interface CreateEventData {
  eventum_name: string;
  event_name: string;
  event_description?: string;
  start_time: string;
  end_time: string;
  location_ids?: number[];
}

export interface UserRole {
  id: number;
  user: User;
  eventum: number;
  role: 'organizer' | 'participant';
  created_at: string;
}

export interface EventumDetails extends Eventum {
  participants_count: number;
  events_count: number;
  organizers: UserRole[];
}

export interface Location {
  id: number;
  name: string;
  slug: string;
  kind: 'venue' | 'building' | 'room' | 'area' | 'other';
  address: string;
  floor: string;
  notes: string;
  parent?: {
    id: number;
    name: string;
    slug: string;
    kind: string;
  } | null;
  children?: Location[];
  full_path: string;
}

export interface CreateLocationData {
  name: string;
  kind: 'venue' | 'building' | 'room' | 'area' | 'other';
  address?: string;
  floor?: string;
  notes?: string;
  parent_id?: number | null;
}

export interface ValidationError {
  [field: string]: string | string[];
}

export interface ApiError {
  detail?: string;
  non_field_errors?: string[];
  [field: string]: string | string[] | undefined;
}

export interface EventRegistration {
  id: number;
  event: Event;
  registered_at: string; // ISO 8601 string date
}

export interface Eventum {
    id: number;
    name: string;
    slug: string;
    description?: string;
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
  user_id?: number;
  eventum: number; // ID of the eventum
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

export interface Event {
  id: number;
  name: string;
  description: string;
  start_time: string; // ISO 8601 string date
  end_time: string;   // ISO 8601 string date
  eventum: number;    // ID of the eventum
  location?: Location; // Локация проведения мероприятия
  location_id?: number; // ID локации для записи
  // (arrays of IDs)
  participants: number[];
  groups: number[];
  tags: EventTag[]; // Объекты тегов для чтения
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
  location_id?: number;
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
  parent_id?: number | null;
  children?: Location[];
}

export interface CreateLocationData {
  name: string;
  kind: 'venue' | 'building' | 'room' | 'area' | 'other';
  address?: string;
  floor?: string;
  notes?: string;
  parent_id?: number | null;
}

export interface Eventum {
    id: number;
    name: string;
    slug: string;
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
  // (arrays of IDs)
  participants: number[];
  groups: number[];
  tags: number[];
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
}

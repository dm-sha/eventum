export interface Eventum {
  id: number;
  name: string;
  slug: string;
  // password_hash мы не получаем на фронтенде, поэтому его здесь нет
}

export type EventumRole = 'organizer' | 'participant';

export interface DashboardEventum extends Eventum {
  role: EventumRole;
  created_at: string;
}

export interface UserProfile {
  organization: string;
  phone: string;
}

export interface AuthUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  profile: UserProfile;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface UserResponse extends AuthTokens {
  user: AuthUser;
}

export interface RefreshResponse {
  access: string;
  refresh?: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface CreateEventumPayload {
  name: string;
  password: string;
}

export interface Participant {
  id: number;
  name: string;
  eventum: number; // ID of the eventum
}

export interface GroupTag {
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

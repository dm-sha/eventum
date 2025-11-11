export interface Eventum {
    id: number;
    name: string;
    slug: string;
    description?: string;
    image_url?: string;
    registration_open: boolean;
    schedule_visible: boolean;
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

export interface EventTag {
  id: number;
  name: string;
  slug: string;
}


export type RegistrationType = 'button' | 'application';

export interface Event {
  id: number;
  name: string;
  description: string;
  start_time: string; // ISO 8601 string date
  end_time: string;   // ISO 8601 string date
  eventum: number;    // ID of the eventum
  locations?: Location[]; // Локации проведения мероприятия (many-to-many)
  location_ids?: number[]; // ID локаций для записи (many-to-many)
  image_url?: string; // URL изображения события
  registrations_count: number; // Количество записанных участников
  is_registered: boolean; // Записан ли текущий пользователь (только для мероприятий с регистрацией)
  is_participant?: boolean; // Участвует ли участник в мероприятии (для расписания, работает для всех мероприятий)
  registration_type?: RegistrationType | null; // Тип регистрации: 'button' - по кнопке, 'application' - по заявкам
  registration_max_participants?: number | null; // Максимальное количество участников для регистрации
  participants_count?: number; // Количество участников по группе (для проверки is_full: participants_count >= registration_max_participants)
  // (arrays of IDs)
  participants: number[];
  tags: EventTag[]; // Объекты тегов для чтения
  event_group?: { id: number; name: string } | null; // Связанная группа (для регистрации)
  event_group_id?: number | null; // ID связанной группы
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
  effective_address?: string;
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

export type RelationType = 'inclusive' | 'exclusive';

export interface ParticipantGroupParticipantRelation {
  id: number;
  relation_type: RelationType;
  group_id: number;
  participant_id: number;
  participant?: Participant;
}

export interface ParticipantGroupGroupRelation {
  id: number;
  relation_type: RelationType;
  group_id: number;
  target_group_id: number;
  target_group?: {
    id: number;
    name: string;
  };
}

export interface ParticipantGroup {
  id: number;
  name: string;
  is_event_group: boolean;
  participant_relations: ParticipantGroupParticipantRelation[];
  group_relations: ParticipantGroupGroupRelation[];
}

export interface CreateParticipantGroupData {
  name: string;
  is_event_group?: boolean;
  participant_relations?: {
    participant_id: number;
    relation_type: RelationType;
  }[];
  group_relations?: {
    target_group_id: number;
    relation_type: RelationType;
  }[];
}

export interface UpdateParticipantGroupData {
  name?: string;
  is_event_group?: boolean;
  participant_relations?: {
    participant_id: number;
    relation_type: RelationType;
  }[];
  group_relations?: {
    target_group_id: number;
    relation_type: RelationType;
  }[];
}

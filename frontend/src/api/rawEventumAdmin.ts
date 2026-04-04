import { createApiRequest } from "./apiClient";
import { getSubdomainSlug } from "../utils/apiUtils";

const slugOrThrow = (eventumSlug?: string): string => {
  const slug = getSubdomainSlug() || eventumSlug;
  if (!slug) throw new Error("Eventum slug is required");
  return slug;
};

/** Ответ GET .../raw/group-structure/ */
export type RawGroupStructureResponse = {
  eventum_id: number;
  groups: Array<{ id: number; name: string; is_event_group: boolean }>;
  participant_relations: Array<{
    id: number;
    group_id: number;
    participant_id: number;
    relation_type: string;
  }>;
  group_relations: Array<{
    id: number;
    group_id: number;
    target_group_id: number;
    relation_type: string;
  }>;
  event_relations: Array<{
    id: number;
    group_id: number;
    event_id: number;
  }>;
};

/** Строка из GET .../raw/participants/ (с join user) */
export type RawParticipantRow = {
  id: number;
  eventum_id: number;
  user_id: number | null;
  name: string;
  user__id: number | null;
  user__vk_id: number | null;
  user__name: string | null;
  user__avatar_url: string | null;
  user__email: string | null;
  user__date_joined: string | null;
  user__last_login: string | null;
};

export async function fetchRawGroupStructure(
  eventumSlug?: string
): Promise<RawGroupStructureResponse> {
  const slug = slugOrThrow(eventumSlug);
  const res = await createApiRequest<RawGroupStructureResponse>(
    "GET",
    "/raw/group-structure/",
    slug
  );
  return res.data;
}

export async function fetchRawParticipants(
  eventumSlug?: string
): Promise<RawParticipantRow[]> {
  const slug = slugOrThrow(eventumSlug);
  const res = await createApiRequest<{ participants: RawParticipantRow[] }>(
    "GET",
    "/raw/participants/",
    slug
  );
  return res.data.participants;
}

export type RawEventRow = {
  id: number;
  eventum_id: number;
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  image_url: string;
  event_group_id: number | null;
  tag_ids: number[];
  location_ids: number[];
  participant_ids: number[];
};

export type RawEventTagRow = {
  id: number;
  eventum_id: number;
  name: string;
  slug: string;
};

export type RawLocationRow = {
  id: number;
  eventum_id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  kind: string;
  address: string;
  floor: string;
  notes: string;
};

export type RawEventRegistrationRow = {
  id: number;
  event_id: number;
  max_participants: number | null;
  allowed_group_id: number | null;
  registration_type: string;
  applicant_ids: number[];
};

export type RawEventWaveRow = {
  id: number;
  eventum_id: number;
  name: string;
  registration_ids: number[];
};

export async function fetchRawEvents(eventumSlug?: string): Promise<RawEventRow[]> {
  const slug = slugOrThrow(eventumSlug);
  const res = await createApiRequest<{ events: RawEventRow[] }>(
    "GET",
    "/raw/events/",
    slug
  );
  return res.data.events;
}

export async function fetchRawEventTags(eventumSlug?: string): Promise<RawEventTagRow[]> {
  const slug = slugOrThrow(eventumSlug);
  const res = await createApiRequest<{ event_tags: RawEventTagRow[] }>(
    "GET",
    "/raw/event-tags/",
    slug
  );
  return res.data.event_tags;
}

export async function fetchRawLocations(eventumSlug?: string): Promise<RawLocationRow[]> {
  const slug = slugOrThrow(eventumSlug);
  const res = await createApiRequest<{ locations: RawLocationRow[] }>(
    "GET",
    "/raw/locations/",
    slug
  );
  return res.data.locations;
}

export async function fetchRawEventRegistrations(
  eventumSlug?: string
): Promise<RawEventRegistrationRow[]> {
  const slug = slugOrThrow(eventumSlug);
  const res = await createApiRequest<{ event_registrations: RawEventRegistrationRow[] }>(
    "GET",
    "/raw/event-registrations/",
    slug
  );
  return res.data.event_registrations;
}

export async function fetchRawEventWaves(eventumSlug?: string): Promise<RawEventWaveRow[]> {
  const slug = slugOrThrow(eventumSlug);
  const res = await createApiRequest<{ event_waves: RawEventWaveRow[] }>(
    "GET",
    "/raw/event-waves/",
    slug
  );
  return res.data.event_waves;
}

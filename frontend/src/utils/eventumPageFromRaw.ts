import type { Event } from "../types";
import type { EventWave } from "../api/eventWave";
import {
  fetchRawEvents,
  fetchRawEventTags,
  fetchRawLocations,
  type RawEventRegistrationRow,
  type RawEventRow,
  type RawEventTagRow,
  type RawEventWaveRow,
  type RawGroupStructureResponse,
  type RawLocationRow,
  type RawParticipantRow,
} from "../api/rawEventumAdmin";
import {
  eventsFromRaw,
  eventRegistrationsFromRaw,
  eventTagsFromRawRows,
  eventWavesFromRaw,
  groupNamesFromStructure,
  rawLocationsToMap,
} from "./adminDataFromRaw";
import { participantGroupsFromRawStructure } from "./participantDataFromRaw";
import {
  resolveParticipantGroupIds,
  type ParticipantGroupResolveOptions,
} from "./resolveParticipantGroup";
import type { ParticipantGroup } from "../types";

function computeIsParticipant(
  e: Event,
  viewingParticipantId: number | null,
  resolveOpts: ParticipantGroupResolveOptions,
  participantGroups: ParticipantGroup[]
): boolean {
  if (!viewingParticipantId) return false;
  if (e.event_group_id) {
    const g = participantGroups.find((x) => x.id === e.event_group_id);
    if (!g) return false;
    return resolveParticipantGroupIds(g, resolveOpts).has(viewingParticipantId);
  }
  return true;
}

function computeIsRegistered(
  e: Event,
  rawReg: RawEventRegistrationRow | undefined,
  viewingParticipantId: number | null,
  resolveOpts: ParticipantGroupResolveOptions,
  participantGroups: ParticipantGroup[]
): boolean {
  if (!viewingParticipantId || !rawReg) return false;
  if (rawReg.registration_type === "button") {
    if (!e.event_group_id) return false;
    const g = participantGroups.find((x) => x.id === e.event_group_id);
    return g ? resolveParticipantGroupIds(g, resolveOpts).has(viewingParticipantId) : false;
  }
  if (e.event_group_id) {
    const g = participantGroups.find((x) => x.id === e.event_group_id);
    if (g && resolveParticipantGroupIds(g, resolveOpts).has(viewingParticipantId)) {
      return true;
    }
  }
  return rawReg.applicant_ids.includes(viewingParticipantId);
}

/**
 * Сборка событий и волн для публичной страницы eventum из raw (доступно организаторам).
 * Дублирует ключевую логику сериализаторов Event / EventWave для просмотра от лица участника.
 */
export function buildEventumPageDataFromRaw(
  eventumId: number,
  rawEv: RawEventRow[],
  rawTags: RawEventTagRow[],
  rawLoc: RawLocationRow[],
  rawRegs: RawEventRegistrationRow[],
  rawWaves: RawEventWaveRow[],
  structure: RawGroupStructureResponse,
  rawParticipants: RawParticipantRow[],
  viewingParticipantId: number | null
): { events: Event[]; eventWaves: EventWave[] } {
  const tagMap = new Map(eventTagsFromRawRows(rawTags).map((t) => [t.id, t]));
  const locMap = rawLocationsToMap(rawLoc);
  const groupNameById = groupNamesFromStructure(structure.groups);
  const participantGroups = participantGroupsFromRawStructure(structure);
  const allParticipantIds = new Set(rawParticipants.map((r) => r.id));

  const resolveOpts: ParticipantGroupResolveOptions = {
    resolveGroup: (id) => participantGroups.find((g) => g.id === id) ?? null,
    allParticipantIds,
  };

  const rawRegByEventId = new Map(rawRegs.map((r) => [r.event_id, r]));
  const rawRegById = new Map(rawRegs.map((r) => [r.id, r]));

  let events = eventsFromRaw(rawEv, tagMap, locMap, groupNameById, eventumId);

  events = events.map((e) => {
    const rawReg = rawRegByEventId.get(e.id);
    let registrations_count = 0;
    let registration_type: Event["registration_type"] = null;
    let registration_max_participants: number | null = null;

    if (rawReg) {
      registration_type = rawReg.registration_type as Event["registration_type"];
      registration_max_participants = rawReg.max_participants;
      if (rawReg.registration_type === "button" && e.event_group_id) {
        const g = participantGroups.find((x) => x.id === e.event_group_id);
        registrations_count = g ? resolveParticipantGroupIds(g, resolveOpts).size : 0;
      } else {
        registrations_count = rawReg.applicant_ids.length;
      }
    }

    let participants_count = 0;
    if (e.event_group_id) {
      const g = participantGroups.find((x) => x.id === e.event_group_id);
      participants_count = g ? resolveParticipantGroupIds(g, resolveOpts).size : 0;
    }

    const is_participant = computeIsParticipant(
      e,
      viewingParticipantId,
      resolveOpts,
      participantGroups
    );
    const is_registered = computeIsRegistered(
      e,
      rawReg,
      viewingParticipantId,
      resolveOpts,
      participantGroups
    );

    return {
      ...e,
      registrations_count,
      participants_count,
      registration_type,
      registration_max_participants,
      is_registered,
      is_participant,
    };
  });

  const eventsById = new Map(events.map((ev) => [ev.id, ev]));
  const regsDomain = eventRegistrationsFromRaw(rawRegs, eventsById);
  let waves = eventWavesFromRaw(rawWaves, regsDomain, eventsById);

  waves = waves.map((w) => ({
    ...w,
    registrations: w.registrations.map((reg) => {
      const rawR = rawRegById.get(reg.id);
      const ev = reg.event?.id ? eventsById.get(reg.event.id) : undefined;
      let registered_count = 0;
      if (rawR) {
        if (rawR.registration_type === "button" && ev?.event_group_id) {
          const g = participantGroups.find((x) => x.id === ev.event_group_id);
          registered_count = g ? resolveParticipantGroupIds(g, resolveOpts).size : 0;
        } else {
          registered_count = rawR.applicant_ids.length;
        }
      }

      let is_accessible = true;
      if (reg.allowed_group == null) {
        is_accessible = true;
      } else if (viewingParticipantId == null) {
        is_accessible = false;
      } else {
        const g = participantGroups.find((x) => x.id === reg.allowed_group);
        is_accessible = g
          ? resolveParticipantGroupIds(g, resolveOpts).has(viewingParticipantId)
          : false;
      }

      return {
        ...reg,
        registered_count,
        is_accessible,
      };
    }),
  }));

  return { events, eventWaves: waves };
}

/** Список мероприятий из публичных raw (без тяжёлого ViewSet). */
export async function loadEventsPickListFromRaw(eventumSlug: string): Promise<Event[]> {
  const [rawEv, rawTags, rawLoc] = await Promise.all([
    fetchRawEvents(eventumSlug),
    fetchRawEventTags(eventumSlug),
    fetchRawLocations(eventumSlug),
  ]);
  if (rawEv.length === 0) {
    return [];
  }
  const eventumId = rawEv[0].eventum_id;
  const tagMap = new Map(eventTagsFromRawRows(rawTags).map((t) => [t.id, t]));
  const locMap = rawLocationsToMap(rawLoc);
  return eventsFromRaw(rawEv, tagMap, locMap, new Map(), eventumId);
}

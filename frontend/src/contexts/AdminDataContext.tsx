import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useEventumSlug } from "../hooks/useEventumSlug";
import { getEventumDetails } from "../api/eventum";
import type { EventRegistration } from "../api/eventRegistration";
import type { EventWave } from "../api/eventWave";
import {
  fetchRawEventRegistrations,
  fetchRawEvents,
  fetchRawEventTags,
  fetchRawEventWaves,
  fetchRawGroupStructure,
  fetchRawLocations,
  fetchRawParticipants,
  type RawGroupStructureResponse,
} from "../api/rawEventumAdmin";
import {
  eventRegistrationsFromRaw,
  eventTagsFromRawRows,
  eventWavesFromRaw,
  eventsFromRaw,
  groupNamesFromStructure,
  locationsFlatToTree,
  rawLocationsToMap,
} from "../utils/adminDataFromRaw";
import {
  participantGroupsFromRawStructure,
  participantsFromRawRows,
} from "../utils/participantDataFromRaw";
import type {
  EventumDetails,
  Participant,
  ParticipantGroup,
  Event,
  EventTag,
  Location,
} from "../types";

export type AdminRefetchScope =
  | "eventum"
  | "participants"
  | "groups"
  | "events"
  | "eventTags"
  | "locations"
  | "registrations"
  | "waves";

type AdminDataContextValue = {
  eventumSlug: string | undefined;
  isLoading: boolean;
  error: Error | null;
  eventumDetails: EventumDetails | null;
  /** Сырой снимок графа групп (связи группа↔событие и т.д.) */
  groupStructureRaw: RawGroupStructureResponse | null;
  participants: Participant[];
  participantGroups: ParticipantGroup[];
  groupsNonEvent: ParticipantGroup[];
  events: Event[];
  eventTags: EventTag[];
  locationsTree: Location[];
  eventRegistrations: EventRegistration[];
  eventWaves: EventWave[];
  refetch: (scope?: AdminRefetchScope | AdminRefetchScope[]) => Promise<void>;
  patchEventumDetails: (next: EventumDetails | null) => void;
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>;
  setParticipantGroups: React.Dispatch<React.SetStateAction<ParticipantGroup[]>>;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  setEventTags: React.Dispatch<React.SetStateAction<EventTag[]>>;
  setLocationsTree: React.Dispatch<React.SetStateAction<Location[]>>;
  setEventRegistrations: React.Dispatch<React.SetStateAction<EventRegistration[]>>;
  setEventWaves: React.Dispatch<React.SetStateAction<EventWave[]>>;
};

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

function buildAdminEntities(
  details: EventumDetails,
  rawParticipantRows: Awaited<ReturnType<typeof fetchRawParticipants>>,
  rawGroupStructure: RawGroupStructureResponse,
  rawEvents: Awaited<ReturnType<typeof fetchRawEvents>>,
  rawTags: Awaited<ReturnType<typeof fetchRawEventTags>>,
  rawLocRows: Awaited<ReturnType<typeof fetchRawLocations>>,
  rawRegs: Awaited<ReturnType<typeof fetchRawEventRegistrations>>,
  rawWaves: Awaited<ReturnType<typeof fetchRawEventWaves>>
) {
  const eventumId = details.id;
  const participants = participantsFromRawRows(rawParticipantRows);
  const participantGroups = participantGroupsFromRawStructure(rawGroupStructure);
  const groupNameById = groupNamesFromStructure(rawGroupStructure.groups);
  const eventTags = eventTagsFromRawRows(rawTags);
  const tagMap = new Map(eventTags.map((t) => [t.id, t]));
  const locMap = rawLocationsToMap(rawLocRows);
  const locationsTree = locationsFlatToTree(rawLocRows);
  const events = eventsFromRaw(
    rawEvents,
    tagMap,
    locMap,
    groupNameById,
    eventumId
  );
  const eventsById = new Map(events.map((e) => [e.id, e]));
  const eventRegistrations = eventRegistrationsFromRaw(rawRegs, eventsById);
  const eventWaves = eventWavesFromRaw(rawWaves, eventRegistrations, eventsById);

  return {
    participants,
    participantGroups,
    events,
    eventTags,
    locationsTree,
    eventRegistrations,
    eventWaves,
  };
}

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const eventumSlug = useEventumSlug();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [eventumDetails, setEventumDetails] = useState<EventumDetails | null>(null);
  const [groupStructureRaw, setGroupStructureRaw] =
    useState<RawGroupStructureResponse | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantGroups, setParticipantGroups] = useState<ParticipantGroup[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventTags, setEventTags] = useState<EventTag[]>([]);
  const [locationsTree, setLocationsTree] = useState<Location[]>([]);
  const [eventRegistrations, setEventRegistrations] = useState<EventRegistration[]>([]);
  const [eventWaves, setEventWaves] = useState<EventWave[]>([]);

  const groupsNonEvent = useMemo(
    () => participantGroups.filter((g) => !g.is_event_group),
    [participantGroups]
  );

  const loadAll = useCallback(async () => {
    if (!eventumSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const [
        details,
        rawParticipantRows,
        rawGroupStructure,
        rawEvents,
        rawTags,
        rawLocRows,
        rawRegs,
        rawWaves,
      ] = await Promise.all([
        getEventumDetails(eventumSlug),
        fetchRawParticipants(eventumSlug),
        fetchRawGroupStructure(eventumSlug),
        fetchRawEvents(eventumSlug),
        fetchRawEventTags(eventumSlug),
        fetchRawLocations(eventumSlug),
        fetchRawEventRegistrations(eventumSlug),
        fetchRawEventWaves(eventumSlug),
      ]);
      setEventumDetails(details);
      setGroupStructureRaw(rawGroupStructure);
      const built = buildAdminEntities(
        details,
        rawParticipantRows,
        rawGroupStructure,
        rawEvents,
        rawTags,
        rawLocRows,
        rawRegs,
        rawWaves
      );
      setParticipants(built.participants);
      setParticipantGroups(built.participantGroups);
      setEvents(built.events);
      setEventTags(built.eventTags);
      setLocationsTree(built.locationsTree);
      setEventRegistrations(built.eventRegistrations);
      setEventWaves(built.eventWaves);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [eventumSlug]);

  useEffect(() => {
    if (!eventumSlug) {
      setEventumDetails(null);
      setGroupStructureRaw(null);
      setParticipants([]);
      setParticipantGroups([]);
      setEvents([]);
      setEventTags([]);
      setLocationsTree([]);
      setEventRegistrations([]);
      setEventWaves([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    loadAll();
  }, [eventumSlug, loadAll]);

  const refetch = useCallback(
    async (scope?: AdminRefetchScope | AdminRefetchScope[]) => {
      if (!eventumSlug) return;
      if (scope === undefined) {
        await loadAll();
        return;
      }
      const scopes = Array.isArray(scope) ? scope : [scope];
      if (scopes.length === 0) {
        await loadAll();
        return;
      }
      const set = new Set(scopes);
      const eventRelated =
        set.has("events") ||
        set.has("eventTags") ||
        set.has("locations") ||
        set.has("registrations") ||
        set.has("waves");

      try {
        if (eventRelated) {
          const [
            details,
            rawP,
            rawG,
            rawEv,
            rawTag,
            rawLoc,
            rawReg,
            rawWave,
          ] = await Promise.all([
            getEventumDetails(eventumSlug),
            fetchRawParticipants(eventumSlug),
            fetchRawGroupStructure(eventumSlug),
            fetchRawEvents(eventumSlug),
            fetchRawEventTags(eventumSlug),
            fetchRawLocations(eventumSlug),
            fetchRawEventRegistrations(eventumSlug),
            fetchRawEventWaves(eventumSlug),
          ]);
          setEventumDetails(details);
          setGroupStructureRaw(rawG);
          setParticipants(participantsFromRawRows(rawP));
          setParticipantGroups(participantGroupsFromRawStructure(rawG));
          const built = buildAdminEntities(
            details,
            rawP,
            rawG,
            rawEv,
            rawTag,
            rawLoc,
            rawReg,
            rawWave
          );
          setEvents(built.events);
          setEventTags(built.eventTags);
          setLocationsTree(built.locationsTree);
          setEventRegistrations(built.eventRegistrations);
          setEventWaves(built.eventWaves);
          return;
        }

        if (set.has("participants") || set.has("groups")) {
          const [rows, structure] = await Promise.all([
            fetchRawParticipants(eventumSlug),
            fetchRawGroupStructure(eventumSlug),
          ]);
          setGroupStructureRaw(structure);
          setParticipants(participantsFromRawRows(rows));
          setParticipantGroups(participantGroupsFromRawStructure(structure));
        }

        if (set.has("eventum")) {
          const d = await getEventumDetails(eventumSlug);
          setEventumDetails(d);
        }
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    },
    [eventumSlug, loadAll]
  );

  const patchEventumDetails = useCallback((next: EventumDetails | null) => {
    setEventumDetails(next);
  }, []);

  const value = useMemo<AdminDataContextValue>(
    () => ({
      eventumSlug,
      isLoading,
      error,
      eventumDetails,
      groupStructureRaw,
      participants,
      participantGroups,
      groupsNonEvent,
      events,
      eventTags,
      locationsTree,
      eventRegistrations,
      eventWaves,
      refetch,
      patchEventumDetails,
      setParticipants,
      setParticipantGroups,
      setEvents,
      setEventTags,
      setLocationsTree,
      setEventRegistrations,
      setEventWaves,
    }),
    [
      eventumSlug,
      isLoading,
      error,
      eventumDetails,
      groupStructureRaw,
      participants,
      participantGroups,
      groupsNonEvent,
      events,
      eventTags,
      locationsTree,
      eventRegistrations,
      eventWaves,
      refetch,
      patchEventumDetails,
    ]
  );

  return (
    <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>
  );
}

export function useAdminData(): AdminDataContextValue {
  const ctx = useContext(AdminDataContext);
  if (!ctx) {
    throw new Error("useAdminData must be used within AdminDataProvider");
  }
  return ctx;
}

/** Вне `AdminDataProvider` возвращает `null` (удобно для компонентов с опциональным источником данных). */
export function useOptionalAdminData(): AdminDataContextValue | null {
  return useContext(AdminDataContext);
}

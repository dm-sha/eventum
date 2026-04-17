import type { EventRegistration } from "../api/eventRegistration";
import type { EventWave } from "../api/eventWave";
import type { Event, EventTag, Location } from "../types";
import type {
  RawEventRegistrationRow,
  RawEventRow,
  RawEventTagRow,
  RawEventWaveRow,
  RawLocationRow,
} from "../api/rawEventumAdmin";

function isoTime(v: string | { toString?: () => string }): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return String(v);
}

/** Полный путь локации по parent_id, как в backend LocationSerializer.get_full_path (через ", "). */
function fullPathFromRawRows(
  locationId: number,
  byId: Map<number, RawLocationRow>
): string {
  const names: string[] = [];
  const seen = new Set<number>();
  let id: number | null = locationId;
  while (id != null) {
    if (seen.has(id)) break;
    seen.add(id);
    const row = byId.get(id);
    if (!row) break;
    names.unshift(row.name);
    id = row.parent_id;
  }
  return names.join(", ");
}

/** Плоские локации → карта id → объект для M2M у событий (без дерева). */
export function rawLocationsToMap(rows: RawLocationRow[]): Map<number, Location> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const map = new Map<number, Location>();
  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      name: r.name,
      slug: r.slug,
      kind: r.kind as Location["kind"],
      address: r.address || "",
      floor: r.floor || "",
      notes: r.notes || "",
      full_path: fullPathFromRawRows(r.id, byId),
    });
  }
  return map;
}

/** Плоский список из raw → дерево для страницы локаций. */
export function locationsFlatToTree(flat: RawLocationRow[]): Location[] {
  const byId = new Map<number, Location>();
  for (const r of flat) {
    byId.set(r.id, {
      id: r.id,
      name: r.name,
      slug: r.slug,
      kind: r.kind as Location["kind"],
      address: r.address || "",
      floor: r.floor || "",
      notes: r.notes || "",
      children: [],
      full_path: r.name,
    });
  }
  for (const r of flat) {
    const node = byId.get(r.id);
    if (!node) continue;
    if (r.parent_id != null) {
      const p = byId.get(r.parent_id);
      if (p) {
        if (!p.children) p.children = [];
        p.children.push(node);
        node.parent = {
          id: p.id,
          name: p.name,
          slug: p.slug,
          kind: p.kind,
        };
      }
    }
  }
  const sortTree = (nodes: Location[]) => {
    nodes.sort((a, b) => a.id - b.id);
    nodes.forEach((n) => n.children?.length && sortTree(n.children));
  };
  const roots = flat
    .filter((r) => r.parent_id == null)
    .map((r) => byId.get(r.id))
    .filter((n): n is Location => n != null);
  sortTree(roots);
  const setPath = (node: Location, prefix: string) => {
    node.full_path = prefix ? `${prefix} / ${node.name}` : node.name;
    (node.children || []).forEach((ch) => setPath(ch, node.full_path));
  };
  roots.forEach((r) => setPath(r, ""));
  return roots;
}

export function eventTagsFromRawRows(rows: RawEventTagRow[]): EventTag[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
  }));
}

export function eventsFromRaw(
  rows: RawEventRow[],
  tagMap: Map<number, EventTag>,
  locationMap: Map<number, Location>,
  groupNameById: Map<number, string>,
  eventumId: number
): Event[] {
  return rows.map((r) => {
    const tags = r.tag_ids
      .map((id) => tagMap.get(id))
      .filter((t): t is EventTag => t != null);
    const locs = r.location_ids
      .map((id) => locationMap.get(id))
      .filter((l): l is Location => l != null);
    const egId = r.event_group_id;
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      start_time: isoTime(r.start_time as unknown as string),
      end_time: isoTime(r.end_time as unknown as string),
      eventum: eventumId,
      locations: locs,
      location_ids: r.location_ids,
      image_url: r.image_url || "",
      registrations_count: 0,
      is_registered: false,
      is_participant: false,
      registration_type: null,
      registration_max_participants: null,
      participants_count: 0,
      participants: r.participant_ids,
      tags,
      event_group_id: egId,
      event_group:
        egId != null
          ? { id: egId, name: groupNameById.get(egId) ?? "" }
          : null,
    };
  });
}

export function eventRegistrationsFromRaw(
  rows: RawEventRegistrationRow[],
  eventsById: Map<number, Event>
): EventRegistration[] {
  return rows.map((r) => {
    const ev = eventsById.get(r.event_id);
    const eventStub = ev
      ? {
          id: ev.id,
          name: ev.name,
          description: ev.description,
          start_time: ev.start_time,
          end_time: ev.end_time,
          event_group_id: ev.event_group_id,
        }
      : {
          id: r.event_id,
          name: "",
          description: "",
          start_time: "",
          end_time: "",
        };
    return {
      id: r.id,
      event: eventStub as EventRegistration["event"] & { event_group_id?: number | null },
      registration_type: r.registration_type as "button" | "application",
      max_participants: r.max_participants,
      allowed_group: r.allowed_group_id,
      registered_count: 0,
      applicants: r.applicant_ids,
    };
  });
}

export function eventWavesFromRaw(
  rawWaves: RawEventWaveRow[],
  allRegistrations: EventRegistration[],
  eventsById: Map<number, Event>
): EventWave[] {
  const regById = new Map(allRegistrations.map((r) => [r.id, r]));
  return rawWaves.map((w) => {
    const regs = w.registration_ids
      .map((id) => regById.get(id))
      .filter((x): x is EventRegistration => x != null);
    const eventIdSet = new Set(regs.map((r) => r.event.id));
    const waveEvents = Array.from(eventIdSet)
      .map((id) => eventsById.get(id))
      .filter((e): e is Event => e != null);
    return {
      id: w.id,
      name: w.name,
      eventum: w.eventum_id,
      allow_multiple_button_registrations: w.allow_multiple_button_registrations ?? false,
      registrations: regs,
      events: waveEvents,
    };
  });
}

/** Имена групп из снимка графа (для event_group подписи). */
export function groupNamesFromStructure(
  groups: Array<{ id: number; name: string }>
): Map<number, string> {
  return new Map(groups.map((g) => [g.id, g.name]));
}

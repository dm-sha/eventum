import type { RawGroupStructureResponse } from "../api/rawEventumAdmin";
import type { Event } from "../types";
import { createEventumGroupGraphFromRaw } from "./eventumGroupGraphFromRaw";

/** Мероприятия без группы участников — в расписании видны всем (гости и не-участники). */
export function filterPublicScheduleEvents(events: Event[]): Event[] {
  const out = events.filter((ev) => (ev.event_group_id ?? null) == null);
  out.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  return out;
}

/**
 * Мероприятия, видимые участнику в расписании / вкладке «Мероприятия» (как в ParticipantModal):
 * без event_group — для всех; иначе — если участник входит в состав группы мероприятия (с вложенностью).
 * Пока нет сырой структуры графа, мероприятия с группой не показываются (как при !groupGraph в модалке).
 */
export function filterEventsVisibleForParticipant(
  events: Event[],
  participantId: number,
  groupStructure: RawGroupStructureResponse | null
): Event[] {
  if (!groupStructure) {
    return events.filter((ev) => (ev.event_group_id ?? null) == null);
  }
  const graph = createEventumGroupGraphFromRaw(groupStructure, new Set());
  const out: Event[] = [];
  for (const ev of events) {
    const gid = ev.event_group_id ?? null;
    if (gid == null) {
      out.push(ev);
    } else if (graph.hasParticipant(gid, participantId)) {
      out.push(ev);
    }
  }
  out.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  return out;
}

import type { ParticipantGroupDirectoryEntry } from "../types";
import type { RawGroupStructureResponse, RawParticipantRow } from "../api/rawEventumAdmin";
import { participantGroupsFromRawStructure } from "./participantDataFromRaw";
import {
  resolveParticipantGroupIds,
  type ParticipantGroupResolveOptions,
} from "./resolveParticipantGroup";

/**
 * Каталог групп для вкладки «Группы» (как GET …/participant-groups-directory/), из raw.
 */
export function buildParticipantGroupsDirectoryFromRaw(
  structure: RawGroupStructureResponse,
  rawParticipants: RawParticipantRow[]
): ParticipantGroupDirectoryEntry[] {
  const participantGroups = participantGroupsFromRawStructure(structure);
  const allParticipantIds = new Set(rawParticipants.map((r) => r.id));
  const nameByParticipantId = new Map(rawParticipants.map((r) => [r.id, r.name]));
  const resolveOpts: ParticipantGroupResolveOptions = {
    resolveGroup: (id) => participantGroups.find((g) => g.id === id) ?? null,
    allParticipantIds,
  };

  const visible = participantGroups
    .filter((g) => g.visible_to_participants && !g.is_event_group)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return visible.map((g) => {
    const ids = resolveParticipantGroupIds(g, resolveOpts);
    const participants = Array.from(ids)
      .filter((id) => nameByParticipantId.has(id))
      .sort((a, b) =>
        (nameByParticipantId.get(a) ?? "").localeCompare(nameByParticipantId.get(b) ?? "", "ru")
      )
      .map((id) => ({ id, name: nameByParticipantId.get(id) ?? "" }));
    return {
      id: g.id,
      name: g.name,
      description: g.description ?? "",
      participants,
    };
  });
}

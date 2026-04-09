import type { Participant, ParticipantGroup, RelationType, User } from "../types";
import type {
  RawGroupStructureResponse,
  RawParticipantRow,
} from "../api/rawEventumAdmin";

function rowToUser(row: RawParticipantRow): User | undefined {
  if (row.user_id == null || row.user__id == null) return undefined;
  return {
    id: row.user__id,
    vk_id: row.user__vk_id ?? 0,
    name: row.user__name ?? "",
    avatar_url: row.user__avatar_url ?? "",
    email: row.user__email ?? "",
    date_joined: row.user__date_joined ?? "",
    last_login: row.user__last_login ?? "",
  };
}

/** Сырые строки участников → тип Participant для UI админки (без поля groups). */
export function participantsFromRawRows(rows: RawParticipantRow[]): Participant[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    eventum: r.eventum_id,
    user_id: r.user_id,
    user: rowToUser(r),
  }));
}

/**
 * Снимок group-structure → ParticipantGroup[] с теми же participant_relations / group_relations,
 * что ожидают страницы админки (без вычисления состава групп на сервере).
 */
export function participantGroupsFromRawStructure(
  data: RawGroupStructureResponse
): ParticipantGroup[] {
  const nameById = new Map<number, string>();
  for (const g of data.groups) {
    nameById.set(g.id, g.name);
  }

  const byId = new Map<number, ParticipantGroup>();
  for (const g of data.groups) {
    byId.set(g.id, {
      id: g.id,
      name: g.name,
      is_event_group: g.is_event_group,
      visible_to_participants: g.visible_to_participants ?? false,
      description: g.description ?? '',
      participant_relations: [],
      group_relations: [],
    });
  }

  for (const pr of data.participant_relations) {
    const group = byId.get(pr.group_id);
    if (!group) continue;
    group.participant_relations.push({
      id: pr.id,
      relation_type: pr.relation_type as RelationType,
      group_id: pr.group_id,
      participant_id: pr.participant_id,
    });
  }

  for (const gr of data.group_relations) {
    const group = byId.get(gr.group_id);
    if (!group) continue;
    const targetName = nameById.get(gr.target_group_id) ?? "";
    group.group_relations.push({
      id: gr.id,
      relation_type: gr.relation_type as RelationType,
      group_id: gr.group_id,
      target_group_id: gr.target_group_id,
      target_group: { id: gr.target_group_id, name: targetName },
    });
  }

  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

import type { RawGroupStructureResponse } from "../api/rawEventumAdmin";

/**
 * Состав групп по сырым связям из raw group-structure — та же логика, что EventumGroupGraph.get_participant_ids
 * в backend/app/utils.py (без inclusive: для группы мероприятия — все участники минус exclusive, иначе пусто).
 */
export function createEventumGroupGraphFromRaw(
  structure: RawGroupStructureResponse,
  allParticipantIds: Set<number>
) {
  type GroupData = {
    is_event_group: boolean;
    inclusive_participants: number[];
    exclusive_participants: number[];
    inclusive_groups: number[];
    exclusive_groups: number[];
  };

  const data = new Map<number, GroupData>();
  for (const g of structure.groups) {
    data.set(g.id, {
      is_event_group: g.is_event_group,
      inclusive_participants: [],
      exclusive_participants: [],
      inclusive_groups: [],
      exclusive_groups: [],
    });
  }

  for (const pr of structure.participant_relations) {
    const row = data.get(pr.group_id);
    if (!row) continue;
    if (pr.relation_type === "inclusive") {
      row.inclusive_participants.push(pr.participant_id);
    } else if (pr.relation_type === "exclusive") {
      row.exclusive_participants.push(pr.participant_id);
    }
  }

  for (const gr of structure.group_relations) {
    const row = data.get(gr.group_id);
    if (!row) continue;
    if (gr.relation_type === "inclusive") {
      row.inclusive_groups.push(gr.target_group_id);
    } else if (gr.relation_type === "exclusive") {
      row.exclusive_groups.push(gr.target_group_id);
    }
  }

  const cache = new Map<number, Set<number>>();

  function getParticipantIds(groupId: number, visited: Set<number>): Set<number> {
    const hit = cache.get(groupId);
    if (hit) return new Set(hit);

    if (visited.has(groupId)) {
      return new Set();
    }
    const nextVisited = new Set(visited);
    nextVisited.add(groupId);

    const groupData = data.get(groupId);
    if (!groupData) {
      const empty = new Set<number>();
      cache.set(groupId, empty);
      return new Set(empty);
    }

    const hasInclusiveP = groupData.inclusive_participants.length > 0;
    const hasInclusiveG = groupData.inclusive_groups.length > 0;

    let result: Set<number>;

    if (!hasInclusiveP && !hasInclusiveG) {
      if (!groupData.is_event_group) {
        result = new Set();
      } else {
        const excluded = new Set(groupData.exclusive_participants);
        for (const tid of groupData.exclusive_groups) {
          for (const pid of getParticipantIds(tid, new Set(nextVisited))) {
            excluded.add(pid);
          }
        }
        result = new Set();
        for (const pid of allParticipantIds) {
          if (!excluded.has(pid)) result.add(pid);
        }
      }
    } else {
      const included = new Set(groupData.inclusive_participants);
      const excluded = new Set(groupData.exclusive_participants);
      for (const tid of groupData.inclusive_groups) {
        for (const pid of getParticipantIds(tid, new Set(nextVisited))) {
          included.add(pid);
        }
      }
      for (const tid of groupData.exclusive_groups) {
        for (const pid of getParticipantIds(tid, new Set(nextVisited))) {
          excluded.add(pid);
        }
      }
      for (const pid of excluded) {
        included.delete(pid);
      }
      result = included;
    }

    cache.set(groupId, result);
    return new Set(result);
  }

  return {
    getParticipantIds: (groupId: number) => getParticipantIds(groupId, new Set()),
    hasParticipant: (groupId: number, participantId: number) =>
      getParticipantIds(groupId, new Set()).has(participantId),
  };
}

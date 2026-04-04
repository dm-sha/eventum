import type { Participant, ParticipantGroup } from "../types";

const INCLUSIVE = "inclusive" as const;
const EXCLUSIVE = "exclusive" as const;

function participantIdFromRelation(rel: {
  participant_id?: number;
  participant?: { id?: number };
}): number {
  return rel.participant_id ?? rel.participant?.id ?? 0;
}

function targetGroupIdFromRelation(rel: {
  target_group_id?: number;
  target_group?: { id?: number };
}): number {
  return rel.target_group_id ?? rel.target_group?.id ?? 0;
}

/**
 * Параметры разрешения графа групп (аналог prefetch-ветки на бэкенде).
 * @see backend ParticipantGroup._get_participant_ids_from_prefetched
 */
export type ParticipantGroupResolveOptions = {
  /** Получить группу по id (в т.ч. черновик с временным id при редактировании). */
  resolveGroup: (groupId: number) => ParticipantGroup | null | undefined;
  /** Все участники eventum — только для групп мероприятия: «нет inclusive → весь eventum минус exclusive». */
  allParticipantIds: ReadonlySet<number>;
};

/**
 * Множество id участников группы с учётом вложенных inclusive/exclusive связей
 * и защиты от циклов — как `ParticipantGroup.get_participants` на бэкенде.
 */
export function resolveParticipantGroupIds(
  group: ParticipantGroup,
  options: ParticipantGroupResolveOptions,
  visitedGroups: Set<number> = new Set()
): Set<number> {
  if (visitedGroups.has(group.id)) {
    return new Set();
  }
  visitedGroups.add(group.id);

  const participantRelations = group.participant_relations ?? [];
  const groupRelations = group.group_relations ?? [];

  const hasInclusiveParticipants = participantRelations.some(
    (rel) => rel.relation_type === INCLUSIVE
  );
  const hasInclusiveGroups = groupRelations.some((rel) => rel.relation_type === INCLUSIVE);

  const resolveNested = (targetGroupId: number, branchVisited: Set<number>): Set<number> => {
    if (targetGroupId <= 0) {
      return new Set();
    }
    const child = options.resolveGroup(targetGroupId);
    if (!child) {
      return new Set();
    }
    return resolveParticipantGroupIds(child, options, branchVisited);
  };

  if (!hasInclusiveParticipants && !hasInclusiveGroups) {
    if (!group.is_event_group) {
      return new Set();
    }
    const includedIds = new Set(options.allParticipantIds);
    const excludedIds = new Set<number>();

    for (const rel of participantRelations) {
      if (rel.relation_type === EXCLUSIVE) {
        const pid = participantIdFromRelation(rel);
        if (pid > 0) {
          excludedIds.add(pid);
        }
      }
    }
    for (const rel of groupRelations) {
      if (rel.relation_type === EXCLUSIVE) {
        const gid = targetGroupIdFromRelation(rel);
        const sub = resolveNested(gid, new Set(visitedGroups));
        for (const x of sub) {
          excludedIds.add(x);
        }
      }
    }
    for (const x of excludedIds) {
      includedIds.delete(x);
    }
    return includedIds;
  }

  const includedIds = new Set<number>();
  const excludedIds = new Set<number>();

  for (const rel of participantRelations) {
    const pid = participantIdFromRelation(rel);
    if (pid <= 0) {
      continue;
    }
    if (rel.relation_type === INCLUSIVE) {
      includedIds.add(pid);
    } else if (rel.relation_type === EXCLUSIVE) {
      excludedIds.add(pid);
    }
  }

  for (const rel of groupRelations) {
    const gid = targetGroupIdFromRelation(rel);
    const sub = resolveNested(gid, new Set(visitedGroups));
    if (rel.relation_type === INCLUSIVE) {
      for (const x of sub) {
        includedIds.add(x);
      }
    } else if (rel.relation_type === EXCLUSIVE) {
      for (const x of sub) {
        excludedIds.add(x);
      }
    }
  }

  for (const x of excludedIds) {
    includedIds.delete(x);
  }
  return includedIds;
}

/**
 * Снимок одной группы: исходная модель + итоговые участники (по той же логике, что на бэкенде).
 */
export type ResolvedParticipantGroup = {
  group: ParticipantGroup;
  participantIds: number[];
  participants: Participant[];
};

export function buildResolvedParticipantGroup(
  group: ParticipantGroup,
  options: ParticipantGroupResolveOptions,
  participantsById: Map<number, Participant>
): ResolvedParticipantGroup {
  const ids = resolveParticipantGroupIds(group, options);
  const participantIds = Array.from(ids).sort((a, b) => a - b);
  const participants: Participant[] = [];
  for (const id of participantIds) {
    const p = participantsById.get(id);
    if (p) {
      participants.push(p);
    }
  }
  return { group, participantIds, participants };
}

export function participantsToIdMap(participants: Participant[]): Map<number, Participant> {
  return new Map(participants.map((p) => [p.id, p]));
}

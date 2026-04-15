/**
 * Алгоритм распределения участников по мероприятиям внутри волны.
 *
 * Задача сводится к задаче максимального потока в двудольном графе:
 *   source → участники → мероприятия → sink
 *
 * Рёбра:
 *   source → participant: capacity 1 (участник может попасть только на одно мероприятие)
 *   participant → event:   capacity 1 (если участник подал заявку)
 *   event → sink:          capacity = max_participants (или ∞)
 *
 * Используется алгоритм Эдмондса-Карпа (BFS-поиск увеличивающих путей).
 */

export type WaveAllocationInput = {
  registrations: Array<{
    registrationId: number;
    eventId: number;
    eventName: string;
    maxCapacity: number | null;
    applicantIds: number[];
  }>;
};

export type EventAssignment = {
  registrationId: number;
  eventId: number;
  eventName: string;
  maxCapacity: number | null;
  applicantIds: number[];
  assignedIds: number[];
};

export type WaveAllocationResult = {
  waveId: number;
  waveName: string;
  events: EventAssignment[];
  unassignedIds: number[];
};

export function allocateWave(
  waveId: number,
  waveName: string,
  input: WaveAllocationInput
): WaveAllocationResult {
  const { registrations } = input;

  const allParticipantSet = new Set<number>();
  for (const reg of registrations) {
    for (const pid of reg.applicantIds) {
      allParticipantSet.add(pid);
    }
  }
  const participantIds = Array.from(allParticipantSet);
  const pIdx = new Map<number, number>();
  participantIds.forEach((pid, i) => pIdx.set(pid, i));

  const P = participantIds.length;
  const E = registrations.length;

  if (P === 0 || E === 0) {
    return {
      waveId,
      waveName,
      events: registrations.map((r) => ({ ...r, assignedIds: [] })),
      unassignedIds: participantIds,
    };
  }

  const N = P + E + 2;
  const SOURCE = 0;
  const SINK = N - 1;

  const cap = new Map<number, Map<number, number>>();
  const adj = new Map<number, Set<number>>();

  const getCap = (u: number, v: number): number => cap.get(u)?.get(v) ?? 0;

  const setCap = (u: number, v: number, val: number) => {
    let row = cap.get(u);
    if (!row) {
      row = new Map();
      cap.set(u, row);
    }
    row.set(v, val);
  };

  const addEdge = (u: number, v: number, c: number) => {
    setCap(u, v, getCap(u, v) + c);
    if (!adj.has(u)) adj.set(u, new Set());
    if (!adj.has(v)) adj.set(v, new Set());
    adj.get(u)!.add(v);
    adj.get(v)!.add(u);
  };

  for (let i = 0; i < P; i++) addEdge(SOURCE, 1 + i, 1);

  for (let j = 0; j < E; j++) {
    for (const pid of registrations[j].applicantIds) {
      const pi = pIdx.get(pid);
      if (pi !== undefined) addEdge(1 + pi, 1 + P + j, 1);
    }
  }

  for (let j = 0; j < E; j++) {
    addEdge(1 + P + j, SINK, registrations[j].maxCapacity ?? P);
  }

  // Edmonds-Karp: BFS augmenting paths
  const bfs = (): Int32Array | null => {
    const parent = new Int32Array(N).fill(-1);
    parent[SOURCE] = SOURCE;
    const queue: number[] = [SOURCE];
    let head = 0;
    while (head < queue.length) {
      const u = queue[head++];
      const neighbors = adj.get(u);
      if (!neighbors) continue;
      for (const v of neighbors) {
        if (parent[v] === -1 && getCap(u, v) > 0) {
          parent[v] = u;
          if (v === SINK) return parent;
          queue.push(v);
        }
      }
    }
    return null;
  };

  for (;;) {
    const parent = bfs();
    if (!parent) break;

    let bottleneck = Infinity;
    for (let v = SINK; v !== SOURCE; v = parent[v]) {
      bottleneck = Math.min(bottleneck, getCap(parent[v], v));
    }

    for (let v = SINK; v !== SOURCE; v = parent[v]) {
      const u = parent[v];
      setCap(u, v, getCap(u, v) - bottleneck);
      setCap(v, u, getCap(v, u) + bottleneck);
    }
  }

  const eventAssignments: EventAssignment[] = registrations.map((reg, j) => {
    const assigned: number[] = [];
    for (let i = 0; i < P; i++) {
      if (getCap(1 + P + j, 1 + i) > 0) {
        assigned.push(participantIds[i]);
      }
    }
    return { ...reg, assignedIds: assigned };
  });

  const assignedSet = new Set(eventAssignments.flatMap((ea) => ea.assignedIds));
  const unassignedIds = participantIds.filter((pid) => !assignedSet.has(pid));

  return { waveId, waveName, events: eventAssignments, unassignedIds };
}

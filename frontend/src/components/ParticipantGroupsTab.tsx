import { useEffect, useMemo, useState } from "react";
import { getParticipantGroupsDirectory } from "../api/eventum";
import type { ParticipantGroupDirectoryEntry } from "../types";
import LoadingSpinner from "./LoadingSpinner";
import LinkifiedText from "./LinkifiedText";

function sortByName(a: ParticipantGroupDirectoryEntry, b: ParticipantGroupDirectoryEntry) {
  return a.name.localeCompare(b.name, "ru");
}

function participantNameMatchesSearch(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return name.toLowerCase().includes(q);
}

function HighlightedName({ name, query }: { name: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{name}</>;
  const lower = name.toLowerCase();
  const qi = lower.indexOf(q.toLowerCase());
  if (qi === -1) return <>{name}</>;
  return (
    <>
      {name.slice(0, qi)}
      <mark className="bg-amber-200/90 text-gray-900 rounded px-0.5 font-medium">{name.slice(qi, qi + q.length)}</mark>
      {name.slice(qi + q.length)}
    </>
  );
}

type Props = {
  eventumSlug: string;
  currentParticipantId: number | null;
};

const ParticipantGroupsTab: React.FC<Props> = ({ eventumSlug, currentParticipantId }) => {
  const [groups, setGroups] = useState<ParticipantGroupDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getParticipantGroupsDirectory(eventumSlug);
        if (!cancelled) setGroups(data);
      } catch {
        if (!cancelled) setError("Не удалось загрузить группы.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventumSlug]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.participants.some((p) => p.name.toLowerCase().includes(q)));
  }, [groups, search]);

  const { mine, others } = useMemo(() => {
    if (currentParticipantId == null) {
      return {
        mine: [] as ParticipantGroupDirectoryEntry[],
        others: [...filtered].sort(sortByName),
      };
    }
    const m: ParticipantGroupDirectoryEntry[] = [];
    const o: ParticipantGroupDirectoryEntry[] = [];
    for (const g of filtered) {
      const inGroup = g.participants.some((p) => p.id === currentParticipantId);
      if (inGroup) m.push(g);
      else o.push(g);
    }
    m.sort(sortByName);
    o.sort(sortByName);
    return { mine: m, others: o };
  }, [filtered, currentParticipantId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }
  if (error) {
    return <div className="text-center text-red-600 py-8">{error}</div>;
  }

  const gridClass = "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4";

  const renderCard = (g: ParticipantGroupDirectoryEntry) => (
    <div key={g.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm h-full">
      <h3 className="text-lg font-semibold text-gray-900">{g.name}</h3>
      {g.description ? (
        <p className="mt-2 text-gray-600 text-sm whitespace-pre-wrap">
          <LinkifiedText text={g.description} />
        </p>
      ) : null}
      <div className="mt-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Участники</p>
        {g.participants.length === 0 ? (
          <p className="text-sm text-gray-500">Нет участников</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-800">
            {g.participants.map((p) => {
              const rowMatch = participantNameMatchesSearch(p.name, search);
              return (
                <li
                  key={p.id}
                  className={
                    rowMatch
                      ? "rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 shadow-sm -mx-0.5"
                      : undefined
                  }
                >
                  <HighlightedName name={p.name} query={search} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="group-participant-search" className="sr-only">
          Поиск по имени участника
        </label>
        <input
          id="group-participant-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени участника…"
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-500 py-8">
          {groups.length === 0 ? "Нет групп, доступных для просмотра." : "Нет групп по запросу."}
        </p>
      ) : (
        <>
          {currentParticipantId != null && mine.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Ваши группы</h2>
              <div className={gridClass}>{mine.map(renderCard)}</div>
            </section>
          )}

          {others.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {currentParticipantId != null && mine.length > 0 ? "Остальные группы" : "Группы"}
              </h2>
              <div className={gridClass}>{others.map(renderCard)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default ParticipantGroupsTab;

import type { Location } from "../types";

/**
 * Одна строка для UI: сегменты путей без повторов.
 * Порядок — от листа к корню: на каждом уровне глубины слева направо по списку локаций,
 * общие предки в конце один раз.
 */
export function formatEventLocationsDisplay(
  locations: Pick<Location, "full_path">[] | undefined | null
): string {
  if (!locations?.length) return "";

  const reversedPaths = locations.map((loc) =>
    loc.full_path
      .split(", ")
      .map((p) => p.trim())
      .filter(Boolean)
      .reverse()
  );

  const maxDepth = Math.max(...reversedPaths.map((p) => p.length), 0);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (let d = 0; d < maxDepth; d++) {
    for (const rev of reversedPaths) {
      if (d >= rev.length) continue;
      const part = rev[d];
      if (!seen.has(part)) {
        seen.add(part);
        ordered.push(part);
      }
    }
  }

  return ordered.join(", ");
}

import "server-only";

type WithId = { id: string };

/**
 * Enkel id-basert union (deterministisk rekkefølge: local først, deretter nye fra remote).
 */
export async function reconcile<T extends WithId>(local: T[], remote: T[]): Promise<T[]> {
  const merged: T[] = [...local];

  for (const r of remote) {
    if (!merged.find((x) => x.id === r.id)) {
      merged.push(r);
    }
  }

  return merged;
}

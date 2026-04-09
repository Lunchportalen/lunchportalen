/**
 * Ordered strategy tokens for audit + mapping. Duplicates preserved for log clarity; mapper dedupes exec types.
 */
export function buildRealityStrategy(
  alignment: string[],
  narrative: string[],
  trust: string[],
  flow: string[],
): string[] {
  return [...alignment, ...narrative, ...trust, ...flow];
}

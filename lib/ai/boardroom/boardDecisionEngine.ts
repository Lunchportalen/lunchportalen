/**
 * Merges CEO / CFO / investor recommendation tokens; order preserved, duplicates removed.
 */
export function mergeBoardDecisions(ceo: string[], cfo: string[], investor: string[]): string[] {
  return [...new Set([...ceo, ...cfo, ...investor])];
}

/**
 * Per-surface action limits (caller supplies current count).
 */

export const MAX_ACTIONS_PER_SURFACE = 3;

export function canRunAction(_surface: string, currentCount: number): boolean {
  return currentCount < MAX_ACTIONS_PER_SURFACE;
}

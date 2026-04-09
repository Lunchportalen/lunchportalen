/**
 * Lightweight recurrent-style state per user (EWMA). Bounded map — not durable across instances.
 * Final intent labels are deterministic given state thresholds.
 */

export type UserIntent = "high_intent" | "medium_intent" | "low_intent";

const MAX_USERS = 10_000;
const hiddenState = new Map<string, number>();

function evictIfNeeded(): void {
  if (hiddenState.size < MAX_USERS) return;
  const first = hiddenState.keys().next().value as string | undefined;
  if (first) hiddenState.delete(first);
}

export function updateState(userId: string, input: number): number {
  const id = String(userId ?? "").trim();
  if (!id) return 0;
  evictIfNeeded();
  const prev = hiddenState.get(id) ?? 0;
  const n = Number.isFinite(input) ? input : 0;
  const next = 0.7 * prev + 0.3 * n;
  hiddenState.set(id, next);
  return next;
}

export function predictNextAction(userId: string): UserIntent {
  const state = hiddenState.get(String(userId ?? "").trim()) ?? 0;
  if (state > 0.7) return "high_intent";
  if (state > 0.3) return "medium_intent";
  return "low_intent";
}

/** Test / rollback helper — clears bounded memory only. */
export function clearSequenceHiddenState(): void {
  hiddenState.clear();
}

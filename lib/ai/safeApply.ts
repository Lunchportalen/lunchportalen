/**
 * Reversible, fail-closed apply for safe improvements.
 * Never mutates the passed arrays in place — snapshots via structured clone / JSON.
 */

export type BlockLevelImprovement<T> = {
  safe: boolean;
  apply?: (blocks: T[]) => T[];
};

export type SafeApplyResult = {
  ok: boolean;
  /** Call to restore previous blocks (single-level undo from caller) */
  revert?: () => void;
};

function snapshotBlocks<T>(blocks: T[]): T[] {
  if (typeof structuredClone === "function") {
    return structuredClone(blocks) as T[];
  }
  return JSON.parse(JSON.stringify(blocks)) as T[];
}

/**
 * Applies a block-level improvement immutably.
 * On failure, restores the snapshot via revert (also returned for explicit undo).
 */
export function applyImprovement<T>(
  improvement: BlockLevelImprovement<T>,
  blocks: T[],
  setBlocks: (next: T[]) => void,
): SafeApplyResult {
  if (!improvement.safe || typeof improvement.apply !== "function") {
    return { ok: false };
  }

  const prev = snapshotBlocks(blocks);

  try {
    const next = improvement.apply(prev);
    if (!Array.isArray(next)) {
      setBlocks(prev);
      return { ok: false };
    }
    setBlocks(next);
    return {
      ok: true,
      revert: () => {
        setBlocks(snapshotBlocks(prev));
      },
    };
  } catch {
    setBlocks(snapshotBlocks(prev));
    return { ok: false, revert: () => setBlocks(snapshotBlocks(prev)) };
  }
}

import "server-only";

import type { DecisionType } from "@/lib/ai/decisionEngine";

import type { PosActionVerb } from "@/lib/pos/decisionRouter";
import type { ProductSurface } from "@/lib/pos/surfaceRegistry";

const store = new Map<string, number>();

function ttlMs(): number {
  const raw = String(process.env.POS_ACTION_MEMORY_TTL_MS ?? "").trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 60_000 && n <= 86_400_000) return Math.floor(n);
  }
  return 3_600_000;
}

export function posActionKey(surface: ProductSurface, action: PosActionVerb, decisionType: DecisionType): string {
  return `${surface}:${action}:${decisionType}`;
}

/** True if this fingerprint was recorded within TTL (duplicate suppression). */
export function wasPosActionRecent(key: string): boolean {
  const t = store.get(key);
  if (t == null) return false;
  if (Date.now() - t > ttlMs()) {
    store.delete(key);
    return false;
  }
  return true;
}

/** Record after a non-observe action is accepted for this cycle. */
export function rememberPosAction(key: string): void {
  store.set(key, Date.now());
  if (store.size > 2_000) {
    const cutoff = Date.now() - ttlMs();
    for (const [k, ts] of store) {
      if (ts < cutoff) store.delete(k);
    }
  }
}

/** @internal Tests */
export function __resetPosActionMemoryForTests(): void {
  store.clear();
}

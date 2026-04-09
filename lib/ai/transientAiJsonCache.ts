/**
 * Short-lived in-process cache for identical AI page-builder prompts (per tenant).
 * Avoids duplicate model calls when users retry the same input within a narrow window.
 * Not persisted; safe for multi-tenant when key includes companyId + userId.
 */

const store = new Map<string, { expiresAt: number; value: unknown }>();
const TTL_MS = 50_000;
const MAX_ENTRIES = 72;

function evictOldest() {
  if (store.size < MAX_ENTRIES) return;
  const first = store.keys().next().value as string | undefined;
  if (first) store.delete(first);
}

/** FNV-1a-ish hash for prompt slice (fast, UTF-16 safe enough for cache keys). */
export function hashPromptSlice(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeTenantAiCacheKey(companyId: string, userId: string, tool: string, userPrompt: string): string {
  const slice = userPrompt.slice(0, 4000);
  return `${companyId}|${userId}|${tool}|${hashPromptSlice(slice)}`;
}

export function peekTransientAiJson(key: string): unknown | undefined {
  const row = store.get(key);
  if (!row) return undefined;
  if (Date.now() > row.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return row.value;
}

export function storeTransientAiJson(key: string, value: unknown): void {
  evictOldest();
  store.set(key, { expiresAt: Date.now() + TTL_MS, value });
}

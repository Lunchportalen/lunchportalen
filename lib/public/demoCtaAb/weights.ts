import { catalogKeysInOrder, type DemoCtaCatalogEntry } from "@/lib/public/demoCtaAb/catalog";

export type DemoCtaWeights = Record<string, number>;

export function normalizeDemoCtaWeightsForKeys(raw: unknown, keys: string[]): DemoCtaWeights {
  const o = raw && typeof raw === "object" ? (raw as Record<string, number>) : {};
  const out: DemoCtaWeights = {};
  for (const k of keys) {
    const v = o[k];
    out[k] = typeof v === "number" && Number.isFinite(v) ? v : 0;
  }
  const sum = keys.reduce((s, k) => s + (out[k] ?? 0), 0);
  if (sum <= 0) {
    const u = 1 / Math.max(1, keys.length);
    for (const k of keys) out[k] = u;
    return out;
  }
  for (const k of keys) out[k] = (out[k] ?? 0) / sum;
  return out;
}

export function alignWeightsToCatalogKeys(
  raw: unknown,
  catalog: Record<string, DemoCtaCatalogEntry>,
  globalFallback: DemoCtaWeights,
): DemoCtaWeights {
  const keys = catalogKeysInOrder(catalog);
  const cur = normalizeDemoCtaWeightsForKeys(raw, keys);
  const g = normalizeDemoCtaWeightsForKeys(globalFallback, keys);
  let anyMissing = false;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const k of keys) {
      if (!(k in o)) {
        anyMissing = true;
        break;
      }
    }
  } else {
    anyMissing = true;
  }
  if (!anyMissing) return cur;
  const merged: DemoCtaWeights = {};
  for (const k of keys) {
    merged[k] = g[k] ?? 1 / keys.length;
  }
  return normalizeDemoCtaWeightsForKeys(merged, keys);
}

export function clampDemoCtaWeightsForKeys(w: DemoCtaWeights, keys: string[], floor: number): DemoCtaWeights {
  const floored: DemoCtaWeights = {};
  for (const k of keys) {
    floored[k] = Math.max(floor, Math.min(1 - floor, w[k] ?? 0));
  }
  const sum = keys.reduce((s, k) => s + floored[k]!, 0);
  if (sum <= 0) {
    const u = 1 / Math.max(1, keys.length);
    for (const k of keys) floored[k] = u;
    return floored;
  }
  for (const k of keys) floored[k]! /= sum;
  return floored;
}

export function pickDemoCtaVariant(weights: DemoCtaWeights, keys: string[]): string {
  const r = Math.random();
  let acc = 0;
  for (const k of keys) {
    acc += weights[k] ?? 0;
    if (r < acc) return k;
  }
  return keys[keys.length - 1] ?? "a";
}

export function winningDemoCtaVariant(weights: DemoCtaWeights, keys: string[]): string {
  let best = keys[0] ?? "a";
  let bestW = weights[best] ?? 0;
  for (const k of keys) {
    const v = weights[k] ?? 0;
    if (v > bestW) {
      bestW = v;
      best = k;
    }
  }
  return best;
}

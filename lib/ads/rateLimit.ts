/**
 * Maks én ROAS-budsjettendring per døgn per kampanje-nøkkel (best effort i langtkjørende Node).
 */

import "server-only";

type GlobalWithRoas = typeof globalThis & {
  __lpRoasBudgetLastChange?: Map<string, number>;
};

const DAY_MS = 86_400_000;

function map(): Map<string, number> {
  const g = globalThis as GlobalWithRoas;
  if (!g.__lpRoasBudgetLastChange) {
    g.__lpRoasBudgetLastChange = new Map();
  }
  return g.__lpRoasBudgetLastChange;
}

export function assertRoasBudgetChangeAllowed(campaignKey: string): { ok: true } | { ok: false; reason: string } {
  const key = campaignKey.trim();
  if (!key) return { ok: false as const, reason: "Mangler kampanjenøkkel" };
  const prev = map().get(key) ?? 0;
  if (Date.now() - prev < DAY_MS) {
    return { ok: false as const, reason: "Maks én ROAS-budsjettendring per døgn per kampanje" };
  }
  return { ok: true as const };
}

export function recordRoasBudgetChange(campaignKey: string): void {
  const key = campaignKey.trim();
  if (!key) return;
  map().set(key, Date.now());
}

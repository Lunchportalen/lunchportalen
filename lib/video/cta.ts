/**
 * CTA-varianter og urgency — deterministisk valg for videomanus.
 */

import type { SocialProductRef } from "@/lib/ai/socialStrategy";

function seedHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Norske CTA-linjer (UTF-8). */
export function generateCTA(_product: SocialProductRef): string[] {
  return ["Bestill nå", "Se utvalget", "Dette må du teste", "Sikre deg denne i dag"];
}

const URGENCY_MARKERS = ["i dag", "nå", "siste", "kun ", "begrenset", "sikre", "skynd", "frist"] as const;

/**
 * Enkel urgency-deteksjon fra produktnavn og URL (ingen ekstern API).
 */
export function detectUrgencyInProduct(product: SocialProductRef): boolean {
  const blob = `${product.name} ${product.url}`.toLowerCase();
  return URGENCY_MARKERS.some((m) => blob.includes(m));
}

/**
 * Velger én CTA deterministisk; ved urgency prioriteres «handlings»-linjer tidligere i listen.
 */
export function pickVideoCta(product: SocialProductRef, hook: string): string {
  const pool = generateCTA(product);
  const urgent = detectUrgencyInProduct(product);
  const h = seedHash(`${product.id}|${hook.slice(0, 48)}`);
  let idx = h % pool.length;
  if (urgent) {
    idx = h % Math.min(2, pool.length);
  }
  return pool[idx] ?? pool[0]!;
}

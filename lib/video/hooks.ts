/**
 * Deterministiske hook-kandidater (nysgjerrighet + spenning) — ingen tilfeldighet.
 */

import type { SocialProductRef } from "@/lib/ai/socialStrategy";

export type VideoHookContext = {
  slotDay?: string;
  /** Fra læring (videoViews > 0); prioriteres først. */
  preferredHooks?: string[];
  /** Åpningslinjer som har fungert (korte trekk). */
  preferredOpenings?: string[];
};

function seedHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function escName(name: string): string {
  const n = name.trim();
  return n.length > 0 ? n : "dette produktet";
}

/** Statiske mønstre — norske, UTF-8. */
const HOOK_TEMPLATES: readonly string[] = [
  "Dette er ikke vanlig {name} …",
  "De fleste gjør dette feil med {name}.",
  "Se hva som skjer når du prøver {name}.",
  "Dette produktet overrasket oss: {name}.",
  "Du kommer ikke til å tro dette om {name}.",
  "Hvorfor {name} sparer teamet tid — uten ekstra styr.",
  "Én ting ved {name} som endrer hverdagen.",
];

function fillTemplate(tpl: string, product: SocialProductRef): string {
  return tpl.replace(/\{name\}/g, escName(product.name));
}

/**
 * Returnerer 3–5 hooks: først lærte (hvis gyldige), deretter deterministisk rotasjon av maler.
 */
export function generateHook(product: SocialProductRef, context?: VideoHookContext): string[] {
  const raw = [...(context?.preferredHooks ?? []), ...(context?.preferredOpenings ?? [])]
    .map((h) => h.trim())
    .filter((h) => h.length >= 8);
  const seenL = new Set<string>();
  const learned: string[] = [];
  for (const h of raw) {
    if (seenL.has(h)) continue;
    seenL.add(h);
    learned.push(h);
    if (learned.length >= 4) break;
  }

  const seed = `${product.id}|${context?.slotDay ?? ""}`;
  const h0 = seedHash(seed);
  const n = HOOK_TEMPLATES.length;
  const count = 3 + (h0 % 3);
  const out: string[] = [];

  for (const L of learned) {
    if (!out.includes(L)) out.push(L);
  }

  let i = 0;
  while (out.length < count && i < n + 5) {
    const idx = (h0 + i * 17) % n;
    const line = fillTemplate(HOOK_TEMPLATES[idx] ?? HOOK_TEMPLATES[0]!, product);
    if (!out.includes(line)) out.push(line);
    i += 1;
  }

  return out.slice(0, Math.min(5, Math.max(3, out.length)));
}

/**
 * B2B lead-hashtagger — ingen generiske «foodie»- eller konsument-tagger.
 */

import type { Location } from "@/lib/social/location";

/** Påkrevde / kjerne B2B (inkl. eksplisitte fra brief). */
export const b2bLeadCore = [
  "#bedriftslunsj",
  "#kontorløsning",
  "#arbeidsplass",
  "#bedriftshverdag",
  "#lunsjordning",
  "#kontorlunsj",
] as const;

export const b2bSecondary = ["#bedrift", "#kontor", "#B2B"] as const;

export const geoTags: Record<Location, readonly string[]> = {
  trondheim: ["#trondheim", "#midtbyen", "#trondheimby"],
  oslo: ["#oslo", "#osloby"],
  tromso: ["#tromso", "#nordnorge"],
  stockholm: ["#stockholm"],
};

/** Bakoverkompatibilitet — gamle import-navn i tester / ekstern kode. */
export const lunchCore = b2bLeadCore;
export const businessTags = b2bSecondary;
export const qualityTags: readonly string[] = [];

export const HASHTAG_MAX = 12;
export const HASHTAG_MIN = 8;

function seedOffset(seed: string, modulo: number): number {
  const digits = seed.replace(/\D/g, "") || "0";
  const n = parseInt(digits.slice(-6), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.abs(n) % Math.max(1, modulo);
}

/**
 * 8–12 tagger: B2B-kjerne + sekundær + geo, deterministisk rotasjon (ingen tilfeldige tagger).
 */
export function generateLunchHashtags(params: { location: Location; rotationSeed?: string }): string[] {
  const { location, rotationSeed = "" } = params;
  const off = seedOffset(rotationSeed, b2bLeadCore.length);

  const corePick: string[] = [];
  for (let i = 0; i < 4; i++) {
    corePick.push(b2bLeadCore[(off + i) % b2bLeadCore.length]!);
  }

  const s0 = seedOffset(rotationSeed + "s", b2bSecondary.length);
  const secPick = [
    b2bSecondary[s0 % b2bSecondary.length]!,
    b2bSecondary[(s0 + 1) % b2bSecondary.length]!,
  ];

  const geo = [...geoTags[location]];

  const merged = [...corePick, ...secPick, ...geo];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of merged) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= HASHTAG_MAX) break;
  }

  let i = 0;
  while (out.length < HASHTAG_MIN && i < b2bLeadCore.length) {
    const t = b2bLeadCore[(off + 4 + i) % b2bLeadCore.length]!;
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
    i += 1;
  }

  return out.slice(0, HASHTAG_MAX);
}

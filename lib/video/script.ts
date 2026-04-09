/**
 * Kort manus for vertikal video (deterministisk, produktfokus).
 */

import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import { pickVideoCta } from "@/lib/video/cta";

export type VideoScript = {
  hook: string;
  middle: string;
  cta: string;
  /** Sammenhengende tekst for TTS / leverandør (deterministisk sammensatt). */
  fullText: string;
};

function seedHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const MIDDLE_VARIANTS = [
  "Kort produktverdi: mindre administrasjon, mer forutsigbarhet — med tydelig kvalitet.",
  "Slik fungerer det i praksis: en rolig arbeidsdag med bedre mat og kontroll.",
  "Visuell demonstrasjon: enkelt for teamet, trygt for beslutningstakere.",
  "Produktet løser hverdagsstress: planlagt, målbart, profesjonelt.",
] as const;

const CTA_VARIANTS = [
  "Bestill nå",
  "Book demo",
  "Les mer og kom i gang",
  "Start enkelt i dag",
] as const;

export type GenerateVideoScriptOptions = {
  /** true: bruk konverterings-CTA-pool ({@link pickVideoCta}); false: behold legacy rotasjon. */
  useConversionCta?: boolean;
};

export function generateVideoScript(
  product: SocialProductRef,
  hook: string,
  options?: GenerateVideoScriptOptions,
): VideoScript {
  const name = product.name.trim() || "Produktet";
  const h = seedHash(`${product.id}|${hook.slice(0, 40)}`);
  const mid = MIDDLE_VARIANTS[h % MIDDLE_VARIANTS.length]!;
  const cta =
    options?.useConversionCta === true ? pickVideoCta(product, hook) : CTA_VARIANTS[(h >> 3) % CTA_VARIANTS.length]!;
  const middle = `${mid} — ${name}.`;
  const fullText = `${hook} ${middle} ${cta}`.replace(/\s+/g, " ").trim();
  return {
    hook,
    middle,
    cta,
    fullText,
  };
}

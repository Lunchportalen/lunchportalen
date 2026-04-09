/**
 * Tidslinje for kort video (5–20 sek samlet, placeholder for render/API).
 */

import { scoreHookStrength } from "@/lib/video/psychology";
import type { VideoScript } from "@/lib/video/script";

export type VideoStructureBeat =
  | {
      type: "hook";
      duration: number;
      text: string;
    }
  | {
      type: "product";
      duration: number;
      media: string | null;
      label: string;
    }
  | {
      type: "cta";
      duration: number;
      text: string;
    };

function clampTotal(target: number, hookD: number, productD: number, ctaD: number): [number, number, number] {
  let a = hookD;
  let b = productD;
  let c = ctaD;
  let sum = a + b + c;
  if (sum <= target) return [a, b, c];
  const scale = target / sum;
  a = Math.max(2, Math.round(a * scale));
  b = Math.max(3, Math.round(b * scale));
  c = Math.max(2, Math.round(c * scale));
  sum = a + b + c;
  if (sum > target) {
    b = Math.max(3, b - (sum - target));
  }
  return [a, b, c];
}

/**
 * Bygger 3-beat struktur. Varighet 5–20 s totalt; justeres deterministisk ut fra hook-lengde.
 */
export function buildVideoStructure(
  script: VideoScript,
  media: { images: string[]; videos: string[] },
): VideoStructureBeat[] {
  const hookLen = script.hook.length;
  const base = 9 + (hookLen % 7);
  const target = Math.min(18, Math.max(5, base));
  const strength = scoreHookStrength(script.hook);
  const mediaW = media.images.length + media.videos.length;

  /** Hook: maks 2,5 s — konverteringsfokus. */
  let hookD = Math.min(2.5, Math.max(2, 2 + (hookLen % 2) * 0.25));
  /** Produkt: dynamisk lengde ut fra media-pool og hook-styrke. */
  let productD = 3.5 + ((hookLen + strength + mediaW * 2) % 5) * 0.5;
  /** CTA: kort og tydelig. */
  let ctaD = 1.5 + ((hookLen >> 2) % 2) * 0.35;
  [hookD, productD, ctaD] = clampTotal(target, hookD, productD, ctaD);
  hookD = Math.min(2.5, Math.max(2, hookD));

  const primaryVisual = media.videos[0] ?? media.images[0] ?? null;

  return [
    { type: "hook", duration: hookD, text: script.hook },
    {
      type: "product",
      duration: productD,
      media: primaryVisual,
      label: media.videos[0] ? "CMS-video / produkt" : "CMS-bilde / produkt",
    },
    { type: "cta", duration: ctaD, text: script.cta },
  ];
}

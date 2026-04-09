/**
 * Rotasjon: vinnere først (høy ROAS), stabil sortering på id ved uavgjort.
 * Tapere ligger bakerst men kan fortsatt få liten vekt via {@link assignCreativeVariants}.
 */

import type { Creative } from "@/lib/ads/creatives";

export function rotateCreatives(creatives: Creative[]): Creative[] {
  return [...creatives].sort((a, b) => {
    const aScore = a.performance?.roas ?? 0;
    const bScore = b.performance?.roas ?? 0;
    if (bScore !== aScore) return bScore - aScore;
    return a.id.localeCompare(b.id, "en");
  });
}

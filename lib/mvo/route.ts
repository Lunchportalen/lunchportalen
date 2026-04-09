import { shouldExplore } from "./explore";
import { pickBestVariant } from "./router";
import type { MvoComboMetrics } from "./types";

/**
 * Adaptiv routing: `random` for kontrollert utforskning (~20 %), ellers beste combo etter omsetning.
 * Returnerer `null` når det ikke finnes data — tvinger aldri all trafikk til én arm uten eksplisitt eksploit.
 */
export function routeUser(
  user: { id?: string | null },
  performanceMap: Record<string, MvoComboMetrics>
): string | "random" | null {
  const id = typeof user?.id === "string" ? user.id.trim() : "";
  if (id && shouldExplore(id)) return "random";
  return pickBestVariant(user, performanceMap);
}

import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import { calculateMargin, hasValidProductEconomics } from "@/lib/product/economics";
import { inventorySignal } from "@/lib/product/inventory";
import { socialRefToProductEconomics } from "@/lib/product/socialRefEconomics";

export type AdCampaignEconomicsGate =
  | {
      ok: true;
      lowStockPriorityReduction: boolean;
      inventoryLevel: ReturnType<typeof inventorySignal>;
      marginPct: number | null;
    }
  | { ok: false; reason: "low_margin" | "out_of_stock" };

/**
 * Før annonsebygg: blokker lav margin / tomt lager når økonomidata finnes.
 * Manglende kost/pris → ingen blokkering (fail-open for eldre kall uten katalogfelt).
 */
export function evaluateAdCampaignEconomicsGate(ref: SocialProductRef | null | undefined): AdCampaignEconomicsGate {
  if (!ref) {
    return { ok: true, lowStockPriorityReduction: false, inventoryLevel: "normal", marginPct: null };
  }
  const econ = socialRefToProductEconomics(ref);
  if (!econ || !hasValidProductEconomics(econ)) {
    return { ok: true, lowStockPriorityReduction: false, inventoryLevel: "normal", marginPct: null };
  }
  const margin = calculateMargin(econ);
  if (margin < 0.2) {
    return { ok: false, reason: "low_margin" };
  }
  if (econ.stock === 0) {
    return { ok: false, reason: "out_of_stock" };
  }
  const inv = inventorySignal(econ);
  const lowStockPriorityReduction = inv === "low";
  return {
    ok: true,
    lowStockPriorityReduction,
    inventoryLevel: inv,
    marginPct: margin * 100,
  };
}

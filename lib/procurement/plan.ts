/**
 * Kobler etterspørsel/meny → innkjøpsforslag (kun forslag, godkjenning utenfor auto-flyt).
 */

import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import type { DemandMenuPlan } from "@/lib/forecast/controlTowerPlan";
import { requireProcurementApproval, type ProcurementApprovalState } from "@/lib/procurement/approval";
import { suggestProcurement, type ProcurementSuggestion } from "@/lib/procurement/engine";
import { PROCUREMENT_MAX_ESTIMATED_COST_NOK, validateProcurement } from "@/lib/procurement/guard";
import type { Supplier } from "@/lib/procurement/suppliers";

export type ProcurementPlanRow = {
  productId: string;
  productName: string;
  menuPriority: boolean;
  suggestion: ProcurementSuggestion | null;
  skipReason: string | null;
  valid: boolean;
  blockReason: string | null;
  approval: ProcurementApprovalState;
};

export type ProcurementPlanResult = {
  ok: boolean;
  message: string;
  horizonDays: number;
  rows: ProcurementPlanRow[];
  totalSuggestedCostValid: number;
  totalSuggestedQtyValid: number;
};

function nameFromCatalog(catalog: SocialProductRef[], productId: string): string {
  const hit = catalog.find((c) => c.id === productId);
  return String(hit?.name ?? "").trim() || productId;
}

/**
 * Bygger innkjøpsplan: bruker forecast-rader fra {@link buildDemandMenuPlan} og leverandørliste per produkt.
 * Rekkefølge: etterspørsel → menyflagg → leverandørvalg og mengde.
 */
export function buildProcurementPlan(
  menuPlan: DemandMenuPlan,
  catalog: SocialProductRef[],
  getSuppliers: (productId: string) => Supplier[],
): ProcurementPlanResult {
  if (!menuPlan.ok) {
    return {
      ok: false,
      message: menuPlan.message,
      horizonDays: menuPlan.horizonDays,
      rows: [],
      totalSuggestedCostValid: 0,
      totalSuggestedQtyValid: 0,
    };
  }

  const menuIds = new Set(menuPlan.weeklyMenu.map((m) => m.productId));
  const rows: ProcurementPlanRow[] = [];
  let totalSuggestedCostValid = 0;
  let totalSuggestedQtyValid = 0;

  for (const p of menuPlan.products) {
    const suppliers = getSuppliers(p.productId);
    const productName = nameFromCatalog(catalog, p.productId);
    const menuPriority = menuIds.has(p.productId);

    if (suppliers.length === 0) {
      rows.push({
        productId: p.productId,
        productName,
        menuPriority,
        suggestion: null,
        skipReason: "Ingen leverandør registrert for produktet",
        valid: false,
        blockReason: null,
        approval: requireProcurementApproval(null),
      });
      continue;
    }

    const suggestion = suggestProcurement(
      { id: p.productId, stock: p.onHand },
      suppliers,
      { forecastPerDay: p.forecastPerDay, horizonDays: menuPlan.horizonDays },
    );

    if (!suggestion) {
      rows.push({
        productId: p.productId,
        productName,
        menuPriority,
        suggestion: null,
        skipReason: "Kunne ikke velge leverandør",
        valid: false,
        blockReason: null,
        approval: requireProcurementApproval(null),
      });
      continue;
    }

    const valid = validateProcurement({
      suggestedQty: suggestion.suggestedQty,
      estimatedCost: suggestion.estimatedCost,
    });

    let blockReason: string | null = null;
    if (!valid) {
      if (suggestion.suggestedQty <= 0) blockReason = "Null mengde — ingen innkjøp foreslått";
      else if (suggestion.estimatedCost > PROCUREMENT_MAX_ESTIMATED_COST_NOK) {
        blockReason = `Estimert kost ${Math.round(suggestion.estimatedCost)} kr over maksgrense ${PROCUREMENT_MAX_ESTIMATED_COST_NOK.toLocaleString("nb-NO")} kr`;
      } else blockReason = "Validering feilet";
    }

    if (valid) {
      totalSuggestedCostValid += suggestion.estimatedCost;
      totalSuggestedQtyValid += suggestion.suggestedQty;
    }

    rows.push({
      productId: p.productId,
      productName,
      menuPriority,
      suggestion,
      skipReason: null,
      valid,
      blockReason,
      approval: requireProcurementApproval(suggestion),
    });
  }

  rows.sort((a, b) => {
    if (a.menuPriority !== b.menuPriority) return a.menuPriority ? -1 : 1;
    if (b.suggestion && a.suggestion) return b.suggestion.estimatedCost - a.suggestion.estimatedCost;
    return a.productName.localeCompare(b.productName, "nb");
  });

  return {
    ok: true,
    message:
      "Innkjøp er kun forslag. Leverandør rangert etter pris, ledetid og pålitelighet. Alle linjer krever manuell godkjenning utenfor auto-ordre.",
    horizonDays: menuPlan.horizonDays,
    rows,
    totalSuggestedCostValid,
    totalSuggestedQtyValid,
  };
}

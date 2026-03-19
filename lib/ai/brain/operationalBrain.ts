/**
 * AI OPERATIONAL BRAIN
 * Sentral AI-motor som analyserer: bestillinger, kapasitet, leveranser, menyer
 * og gir operasjonelle anbefalinger daglig.
 */

import { detectKitchenRisks } from "@/lib/ai/capabilities/kitchenRiskDetector";
import type { KitchenSlotInput } from "@/lib/ai/capabilities/kitchenRiskDetector";
import { suggestRouteAndWindows } from "@/lib/ai/capabilities/deliveryRouteIntelligence";
import type { DeliveryStopInput, DepotInput } from "@/lib/ai/capabilities/deliveryRouteIntelligence";

export type OperationalOrdersSummary = {
  date: string;
  totalPlannedOrders: number;
  slots?: { slotId: string; slotLabel?: string; plannedOrders: number }[];
};

export type OperationalCapacitySummary = {
  slots: KitchenSlotInput[];
};

export type OperationalDeliverySummary = {
  depot?: DepotInput | null;
  stops: DeliveryStopInput[];
};

export type OperationalMenuSummary = {
  date?: string | null;
  itemCount?: number | null;
  lowStockItems?: { itemId: string; name: string; remaining?: number }[] | null;
};

export type OperationalBrainInput = {
  orders?: OperationalOrdersSummary | null;
  capacity?: OperationalCapacitySummary | null;
  delivery?: OperationalDeliverySummary | null;
  menu?: OperationalMenuSummary | null;
  date?: string | null;
  locale?: "nb" | "en" | null;
};

export type OperationalRecommendationCategory = "orders" | "capacity" | "delivery" | "menu";

export type OperationalRecommendation = {
  category: OperationalRecommendationCategory;
  severity: "high" | "medium" | "low";
  title: string;
  action: string;
  source: string;
  valueHint?: string | null;
};

export type OperationalBrainOutput = {
  recommendations: OperationalRecommendation[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Analyserer bestillinger, kapasitet, leveranser og menyer; returnerer daglige operasjonelle anbefalinger.
 */
export function getDailyOperationalRecommendations(
  input: OperationalBrainInput
): OperationalBrainOutput {
  const isEn = input.locale === "en";
  const recommendations: OperationalRecommendation[] = [];
  const dateLabel = safeStr(input.date) || new Date().toISOString().slice(0, 10);

  if (input.capacity?.slots?.length) {
    const riskResult = detectKitchenRisks({
      slots: input.capacity.slots,
      locale: input.locale ?? "nb",
    });
    for (const r of riskResult.risks) {
      recommendations.push({
        category: "capacity",
        severity: r.severity,
        title: r.description,
        action: r.suggestedAction,
        source: "kitchen_risk_detector",
        valueHint: r.valueHint ?? undefined,
      });
    }
  }

  if (input.delivery?.stops?.length) {
    const routeResult = suggestRouteAndWindows({
      depot: input.delivery.depot ?? undefined,
      stops: input.delivery.stops,
      locale: input.locale ?? "nb",
    });
    if (routeResult.windowSuggestions.length > 0) {
      const first = routeResult.windowSuggestions[0]!;
      recommendations.push({
        category: "delivery",
        severity: "medium",
        title: first.suggestion,
        action: first.rationale,
        source: "delivery_route_intelligence",
      });
    }
  }

  if (input.orders) {
    const total = safeNum(input.orders.totalPlannedOrders);
    if (total === 0) {
      recommendations.push({
        category: "orders",
        severity: "low",
        title: isEn ? "No orders planned for the period." : "Ingen bestillinger planlagt for perioden.",
        action: isEn ? "Confirm date and visibility of offering." : "Bekreft dato og synlighet av tilbudet.",
        source: "operational_brain",
      });
    } else if (input.orders.slots?.length) {
      const maxSlot = input.orders.slots.reduce(
        (best, s) => (safeNum(s.plannedOrders) > safeNum(best.plannedOrders) ? s : best),
        input.orders.slots[0]!
      );
      const maxOrders = safeNum(maxSlot.plannedOrders);
      if (maxOrders > 0) {
        recommendations.push({
          category: "orders",
          severity: "low",
          title: isEn
            ? `Peak slot: ${maxSlot.slotLabel ?? maxSlot.slotId} with ${maxOrders} orders.`
            : `Toppvindu: ${maxSlot.slotLabel ?? maxSlot.slotId} med ${maxOrders} bestillinger.`,
          action: isEn ? "Ensure capacity and prep align with peak." : "Sørg for at kapasitet og tilberedning matcher topp.",
          source: "operational_brain",
          valueHint: `${total} totalt`,
        });
      }
    }
  }

  if (input.menu?.lowStockItems?.length) {
    const items = input.menu.lowStockItems;
    const names = items.map((i) => safeStr(i.name) || i.itemId).filter(Boolean);
    recommendations.push({
      category: "menu",
      severity: items.length > 2 ? "high" : "medium",
      title: isEn
        ? `Low stock or attention needed: ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}.`
        : `Lav beholdning eller oppmerksomhet: ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}.`,
      action: isEn ? "Restock or substitute before service." : "Fyll på eller bytt ut før servering.",
      source: "operational_brain",
      valueHint: `${items.length} varer`,
    });
  }

  recommendations.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  const highCount = recommendations.filter((r) => r.severity === "high").length;
  const summary = isEn
    ? `Daily ops for ${dateLabel}: ${recommendations.length} recommendation(s), ${highCount} high priority. Use for operational planning.`
    : `Daglige ops for ${dateLabel}: ${recommendations.length} anbefaling(er), ${highCount} høy prioritet. Bruk til operativ planlegging.`;

  return {
    recommendations,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Kjører operasjonshjernen: analyserer bestillinger, kapasitet, leveranser, menyer og returnerer daglige anbefalinger.
 */
export function runOperationalBrain(input: OperationalBrainInput): OperationalBrainOutput {
  return getDailyOperationalRecommendations(input);
}

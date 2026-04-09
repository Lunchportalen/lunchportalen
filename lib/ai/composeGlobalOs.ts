/**
 * Sammensatt «Global OS»-snapshot for kontrolltårn — additiv, deterministisk kjerne, fullt observerbar.
 * Ingen sideeffekter; ingen auto-utførelse.
 */

import type { DailyDemandAgg, OrderRowForDemand } from "@/lib/ai/demandData";
import type { ProcurementLine } from "@/lib/ai/procurementEngine";
import type { RouteStopInput } from "@/lib/ai/routePlanner";
import type { DishChoiceSignal } from "@/lib/ai/demandInsights";
import { multiCityFromOrdersAndLocations } from "@/lib/ai/multiCityEngine";
import { activeDemandByLocation } from "@/lib/ai/multiCityEngine";
import { assessInventoryFromProcurement } from "@/lib/ai/inventoryEngine";
import { compareSuppliersLive, pickFallbackSupplier } from "@/lib/ai/supplierNetworkEngine";
import type { SimulatedQuote } from "@/lib/ai/supplierConnector";
import { optimizeDistribution } from "@/lib/ai/distributionEngine";
import { buildDecisionStreamSnapshot } from "@/lib/ai/decisionStream";
import { computeRealtimeProfitability } from "@/lib/ai/profitEngine";
import { detectOperationalAnomalies } from "@/lib/ai/anomalyEngine";
import { runWhatIfSimulation } from "@/lib/ai/simulationEngine";
import { suggestRemediations } from "@/lib/ai/selfHealSuggestions";
import { summarizeTenantLearningPatterns } from "@/lib/ai/globalLearningLoop";
import { DEFAULT_POLICY_RULES, buildOperationsPolicyNotes } from "@/lib/ai/policyEngine";
import { addDaysISO } from "@/lib/date/oslo";

export type GlobalOsSnapshot = {
  schemaVersion: number;
  snapshotAsOf: string;
  operationsVersion: string;
  layers: {
    demand: { multiCity: ReturnType<typeof multiCityFromOrdersAndLocations> };
    inventory: { lines: ReturnType<typeof assessInventoryFromProcurement> };
    suppliers: {
      comparisons: Array<{
        ingredient: string;
        quotes: SimulatedQuote[];
        recommended: SimulatedQuote | null;
        fallback: SimulatedQuote | null;
      }>;
    };
    distribution: ReturnType<typeof optimizeDistribution>;
    decisionStream: ReturnType<typeof buildDecisionStreamSnapshot>;
    profit: ReturnType<typeof computeRealtimeProfitability>;
    anomalies: ReturnType<typeof detectOperationalAnomalies>;
    remediations: ReturnType<typeof suggestRemediations>;
    simulations: ReturnType<typeof runWhatIfSimulation>[];
    learning: ReturnType<typeof summarizeTenantLearningPatterns>;
    policy: { notes: string[] };
  };
  transparency: string[];
};

function slugCity(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/gi, "-")
    .replace(/^-|-$/g, "") || "hub";
}

function hashVersionKey(parts: string[]): string {
  let h = 0;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return `v1-${(h >>> 0).toString(16)}`;
}

function ingredientCostPerMealEstimate(lines: ProcurementLine[], weeklyPortionsEstimate: number): number | null {
  if (!lines.length) return null;
  const w = Math.max(1, Math.round(weeklyPortionsEstimate));
  const totalKg = lines.reduce((s, l) => s + Math.max(0, l.totalWithBuffer), 0);
  const avgNokPerKg = 42;
  const weeklyCost = totalKg * avgNokPerKg;
  return Math.round((weeklyCost / w) * 100) / 100;
}

export function composeGlobalOsSnapshot(input: {
  snapshotAsOf: string;
  companyId: string;
  rows: OrderRowForDemand[];
  locations: Array<{ id: string; name: string; city: string }>;
  history: DailyDemandAgg[];
  nextForecastPortions: number;
  procurementLines: ProcurementLine[];
  routeOrdered: RouteStopInput[];
  hindcastError: number | null;
  currentPriceExVat: number | null;
  weeklyPortionsEstimate: number;
  dishSignals: DishChoiceSignal[];
}): GlobalOsSnapshot {
  const today = input.snapshotAsOf;
  const from = addDaysISO(today, -13);
  const demandByLoc = activeDemandByLocation(input.rows, from, today);
  const multiCity = multiCityFromOrdersAndLocations(input.rows, input.locations, today, 14);

  const seed = `${input.companyId}|${today}`;
  const inventoryLines = assessInventoryFromProcurement(input.procurementLines, input.nextForecastPortions, seed);

  const topIngredients = [...input.procurementLines]
    .sort((a, b) => b.totalWithBuffer - a.totalWithBuffer)
    .slice(0, 4)
    .map((l) => String(l.ingredient ?? "").trim())
    .filter(Boolean);

  const comparisons = topIngredients.map((ingredient) => {
    const quotes = compareSuppliersLive(ingredient);
    const recommended = pickFallbackSupplier(quotes);
    const rest = quotes.filter((q) => q.supplierId !== recommended?.supplierId);
    const fallback = pickFallbackSupplier(rest);
    return { ingredient, quotes, recommended, fallback };
  });

  const byCity = new Map<string, typeof input.locations>();
  for (const loc of input.locations) {
    const c = String(loc.city ?? "").trim() || "Ukjent";
    if (!byCity.has(c)) byCity.set(c, []);
    byCity.get(c)!.push(loc);
  }

  const allAssignments: ReturnType<typeof optimizeDistribution>["assignments"] = [];
  const distExplain: string[] = [];
  let totalCostIndexLoad = 0;

  for (const row of multiCity) {
    const locs = byCity.get(row.city) ?? [];
    const kitchens = [
      {
        id: `hub-${slugCity(row.city)}`,
        name: `Produksjon ${row.city}`,
        maxPortionsPerDay: Math.max(1, row.capacity),
        costIndex: 1,
      },
    ];
    const zones = locs.map((l) => ({
      zoneId: l.id,
      label: l.name,
      portions: demandByLoc.get(l.id) ?? 0,
    }));
    if (zones.length === 0 && row.demand > 0) {
      zones.push({
        zoneId: `sone-${slugCity(row.city)}`,
        label: row.city,
        portions: row.demand,
      });
    }
    const plan = optimizeDistribution(kitchens, zones);
    allAssignments.push(...plan.assignments);
    distExplain.push(...plan.explain);
    totalCostIndexLoad += plan.totalCostIndexLoad;
  }

  const distribution = {
    assignments: allAssignments,
    explain: [...new Set(distExplain)],
    totalCostIndexLoad,
  };

  const cityRatios = multiCity.map((c) => ({
    city: c.city,
    ratio: c.capacity > 0 ? c.demand / c.capacity : 0,
  }));

  const anomalies = detectOperationalAnomalies({
    history: input.history,
    hindcastError: input.hindcastError,
    cityLoadRatios: cityRatios,
  });

  const remediations = suggestRemediations(anomalies);

  const sumDemand = multiCity.reduce((s, c) => s + c.demand, 0);
  const sumCap = multiCity.reduce((s, c) => s + c.capacity, 0) || 1;
  const simulations = [
    runWhatIfSimulation("demand_spike", { demand: sumDemand, capacity: sumCap, leadTimeDays: 2 }),
    runWhatIfSimulation("supplier_failure", { demand: sumDemand, capacity: sumCap, leadTimeDays: 2 }),
    runWhatIfSimulation("delivery_delay", { demand: sumDemand, capacity: sumCap, leadTimeDays: 2 }),
  ];

  const learning = summarizeTenantLearningPatterns({
    companyId: input.companyId,
    dishSignals: input.dishSignals,
    historyDepthDays: input.history.length,
  });

  const supplierIds = [...new Set(comparisons.flatMap((c) => c.quotes.map((q) => q.supplierId)))];
  const policyNotes = buildOperationsPolicyNotes({
    rules: DEFAULT_POLICY_RULES,
    currentPriceExVat: input.currentPriceExVat,
    supplierIdsInPlan: supplierIds,
  });

  const profit = computeRealtimeProfitability({
    pricePerMealExVat: input.currentPriceExVat,
    ingredientCostEstimateNok: ingredientCostPerMealEstimate(input.procurementLines, input.weeklyPortionsEstimate),
    forecastErrorPortions: input.hindcastError,
    wasteUnitCostNok: 35,
  });

  const routeSummary = input.routeOrdered.map((s) => `${s.name} (${s.windowStart}–${s.windowEnd})`);
  const supplierNote =
    comparisons[0]?.recommended != null
      ? `Primær leverandør (simulert) for «${comparisons[0]!.ingredient}»: ${comparisons[0]!.recommended!.supplierName}.`
      : "Ingen leverandørsammenligning — mangler ingrediensdata.";

  const decisionStream = buildDecisionStreamSnapshot({
    snapshotAsOf: today,
    ridPrefix: slugCity(input.companyId).slice(0, 8),
    cityRows: multiCity,
    inventory: inventoryLines,
    routeSummary,
    supplierNote,
    policyNotes,
  });

  const operationsVersion = hashVersionKey([
    input.companyId,
    today,
    String(sumDemand),
    String(inventoryLines.length),
    String(anomalies.length),
  ]);

  const transparency = [
    "Global OS V1 er et additivt observasjonslag — ingen endringer i databaser, avtaler eller priser.",
    "Multi-city etterspørsel er ACTIVE-ordrer per lokasjon siste 14 dager; kapasitet er heuristikk.",
    "Lager og margin er estimater; revisjon mot faktisk regnskap og WMS er obligatorisk før beslutning.",
    "Alle korreksjonsforslag krever eksplisitt godkjenning — ingen auto-utførelse.",
  ];

  return {
    schemaVersion: 1,
    snapshotAsOf: today,
    operationsVersion,
    layers: {
      demand: { multiCity },
      inventory: { lines: inventoryLines },
      suppliers: { comparisons },
      distribution,
      decisionStream,
      profit,
      anomalies,
      remediations,
      simulations,
      learning,
      policy: { notes: policyNotes },
    },
    transparency,
  };
}

/**
 * Setter sammen autonomi, policy og beslutninger for kontrolltårn-API.
 */

import type { DailyDemandAgg } from "@/lib/ai/demandData";
import type { DemandForecastOutput } from "@/lib/ai/demandEngine";
import { buildEngineDecisions, type EngineDecision } from "@/lib/ai/decisionEngine";
import {
  DEFAULT_POLICY_RULES,
  evaluatePolicyForDecision,
  type PolicyDecisionContext,
} from "@/lib/ai/policyEngine";
import {
  modeForLevel,
  normalizeAutonomyLevel,
  presentationForDecision,
  type AutonomyLevel,
} from "@/lib/ai/autonomyController";
import { suggestWeeklyMenu } from "@/lib/ai/menuEngine";
import { buildSafePricingSuggestions } from "@/lib/ai/pricingEngine";
import { monitorOperations } from "@/lib/ai/opsMonitor";
import type { DishChoiceSignal } from "@/lib/ai/demandInsights";
import type { ProcurementLine } from "@/lib/ai/procurementEngine";
import type { WeekdayKeyMonFri } from "@/lib/date/weekdayKeyFromIso";
import { MultiSupplierStubConnector, type SimulatedQuote } from "@/lib/ai/supplierConnector";

export type ComposedTowerDecision = EngineDecision & {
  policyAllowed: boolean;
  policyReasons: string[];
  effectiveAutonomyLevel: AutonomyLevel;
  observeOnly: boolean;
  showApproveReject: boolean;
  assistPrefill: Record<string, unknown> | null;
};

export type ComposedAutonomyPayload = {
  autonomy: {
    level: AutonomyLevel;
    mode: ReturnType<typeof modeForLevel>;
    effectiveLevel: AutonomyLevel;
    transparency: string[];
  };
  decisions: ComposedTowerDecision[];
  decisionsBlocked: Array<
    EngineDecision & { policyReasons: string[]; effectiveAutonomyLevel: AutonomyLevel }
  >;
  menuSuggestion: ReturnType<typeof suggestWeeklyMenu>;
  pricingSuggestions: ReturnType<typeof buildSafePricingSuggestions>;
  opsMonitor: ReturnType<typeof monitorOperations>;
  supplierSimulations: Array<{
    ingredientLabel: string;
    quote: SimulatedQuote;
  }>;
  explainability: {
    why: string;
    dataUsed: string[];
    expectedOutcomeNote: string;
  };
};

function deliveryDaysArray(set: ReadonlySet<WeekdayKeyMonFri> | null): WeekdayKeyMonFri[] | null {
  if (!set || set.size === 0) return null;
  const order: WeekdayKeyMonFri[] = ["mon", "tue", "wed", "thu", "fri"];
  return order.filter((d) => set.has(d));
}

export function composeOperationsAutonomy(opts: {
  history: DailyDemandAgg[];
  dishSignals: DishChoiceSignal[];
  nextForecast: DemandForecastOutput;
  hindcastAbsError: number | null;
  procurementLines: ProcurementLine[];
  locationCount: number;
  weeklyPortionsEstimate: number;
  currentPriceExVat: number | null;
  deliveryWeekdays: Set<WeekdayKeyMonFri> | null;
  /** Fra query eller default 1 */
  requestedAutonomy: unknown;
}): ComposedAutonomyPayload {
  const level = normalizeAutonomyLevel(opts.requestedAutonomy);
  const hasActiveAgreement = Boolean(opts.deliveryWeekdays && opts.deliveryWeekdays.size > 0);

  const policyCtx: PolicyDecisionContext = {
    hasActiveAgreement,
    rules: DEFAULT_POLICY_RULES,
    configuredAutonomyLevel: level,
  };

  const high = opts.dishSignals.filter((d) => d.signal === "high").map((d) => d.choiceKey);
  const low = opts.dishSignals.filter((d) => d.signal === "low").map((d) => d.choiceKey);
  const ranked = [...opts.dishSignals].sort((a, b) => b.count - a.count).map((d) => d.choiceKey);

  const procKg = opts.procurementLines.reduce((s, l) => s + l.totalWithBuffer, 0);

  const raw = buildEngineDecisions({
    predictedOrders: opts.nextForecast.predictedOrders,
    forecastConfidence: opts.nextForecast.confidence,
    topMenuKeys: high.length ? high : ranked.slice(0, 1),
    weakMenuKeys: low,
    hindcastAbsError: opts.hindcastAbsError,
    procurementTotalKg: procKg,
    locationCount: opts.locationCount,
    weeklyPortionsEstimate: opts.weeklyPortionsEstimate,
    currentPriceExVat: opts.currentPriceExVat,
  });

  const decisions: ComposedTowerDecision[] = [];
  const decisionsBlocked: ComposedAutonomyPayload["decisionsBlocked"] = [];

  let effectiveLevel: AutonomyLevel = level;

  for (const d of raw) {
    const pol = evaluatePolicyForDecision(d.type, {
      ctx: policyCtx,
      proposedPriceDeltaPercent: d.proposedPriceDeltaPercent ?? undefined,
    });
    effectiveLevel = pol.effectiveAutonomyLevel;

    const pres = presentationForDecision({
      level: pol.effectiveAutonomyLevel,
      policyAllowed: pol.allowed,
      minConfidenceForRecommend: 0.42,
      confidence: d.confidence,
    });

    const row: ComposedTowerDecision = {
      ...d,
      policyAllowed: pol.allowed,
      policyReasons: pol.blockedReasons,
      effectiveAutonomyLevel: pol.effectiveAutonomyLevel,
      observeOnly: pres.observeOnly,
      showApproveReject: pres.showApproveReject,
      assistPrefill: pres.assistPrefill,
    };

    if (pol.allowed) decisions.push(row);
    else decisionsBlocked.push({ ...d, policyReasons: pol.blockedReasons, effectiveAutonomyLevel: pol.effectiveAutonomyLevel });
  }

  const menuSuggestion = suggestWeeklyMenu({
    deliveryDays: deliveryDaysArray(opts.deliveryWeekdays),
    rankedMenuKeys: ranked.length ? ranked : ["standard"],
  });

  const pricingSuggestions = buildSafePricingSuggestions({
    currentPriceExVat: opts.currentPriceExVat,
    forecastConfidence: opts.nextForecast.confidence,
    hindcastAbsError: opts.hindcastAbsError,
    maxDeltaPercent: DEFAULT_POLICY_RULES.maxPriceDeltaPercent,
  });

  const opsMonitor = monitorOperations(opts.history, { lastNDays: 10 });

  const supplierNet = new MultiSupplierStubConnector();
  const supplierSimulations: ComposedAutonomyPayload["supplierSimulations"] = [];
  for (const line of opts.procurementLines.slice(0, 3)) {
    supplierSimulations.push({
      ingredientLabel: line.ingredient,
      quote: supplierNet.simulateQuote(line.ingredient.toLowerCase().replace(/\s+/g, "_")),
    });
  }

  const explainability = {
    why: "Alle forslag er regel- og datadrevet; policy blokkerer risiko; autonomi begrenser hvordan forslag vises.",
    dataUsed: [
      "orders (per dag)",
      "day_choices",
      "demandEngine V1",
      "procurementEngine",
      "company_locations",
      "pris eks. mva (hvis satt)",
    ],
    expectedOutcomeNote:
      "Godkjente grep kan redusere svinn og variasjon; avviste grep brukes i fremtidig kalibrering via revisjonslogg.",
  };

  const autonomyTransparency = [
    `Autonomi nivå ${effectiveLevel} (${modeForLevel(effectiveLevel)}): ${level === 0 ? "kun lesing" : level === 1 ? "anbefalinger med godkjenning" : "utkast/prefyll med godkjenning"}.`,
    "Nivå 3 (semi-auto) er ikke aktivert — ingen hopp over menneskelig kontroll.",
  ];

  return {
    autonomy: {
      level,
      mode: modeForLevel(level),
      effectiveLevel,
      transparency: autonomyTransparency,
    },
    decisions,
    decisionsBlocked,
    menuSuggestion,
    pricingSuggestions,
    opsMonitor,
    supplierSimulations,
    explainability,
  };
}

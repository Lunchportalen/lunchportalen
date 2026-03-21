/**
 * AI Delivery Intelligence capability: optimizeDeliveryPlan.
 * Optimaliserer leveringsplan: ruter, tidsvinduer, prioritering.
 * Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "deliveryIntelligence";

const deliveryIntelligenceCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Delivery intelligence: optimizes delivery plan — routes, time windows, prioritization. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Delivery intelligence input",
    properties: {
      depot: {
        type: "object",
        properties: { lat: { type: "number" }, lon: { type: "number" }, label: { type: "string" } },
      },
      stops: {
        type: "array",
        items: {
          type: "object",
          properties: {
            stopId: { type: "string" },
            label: { type: "string" },
            lat: { type: "number" },
            lon: { type: "number" },
            slotId: { type: "string" },
            orderCount: { type: "number" },
            windowStartMinutes: { type: "number", description: "Minutes from midnight" },
            windowEndMinutes: { type: "number" },
            priorityHint: { type: "string", enum: ["urgent", "high_volume", "narrow_window", "normal"] },
          },
        },
      },
      currentWindows: {
        type: "array",
        description: "Existing delivery windows (slotId, start, end)",
        items: {
          type: "object",
          properties: {
            slotId: { type: "string" },
            label: { type: "string" },
            startMinutes: { type: "number" },
            endMinutes: { type: "number" },
          },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["stops"],
  },
  outputSchema: {
    type: "object",
    description: "Optimized delivery plan",
    required: [
      "suggestedRoute",
      "timeWindowSuggestions",
      "prioritization",
      "summary",
      "generatedAt",
    ],
    properties: {
      suggestedRoute: { type: "object" },
      timeWindowSuggestions: { type: "array", items: { type: "object" } },
      prioritization: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "suggestions_only",
      description: "Output is delivery plan suggestions only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api", "driver"],
};

registerCapability(deliveryIntelligenceCapability);

export type DeliveryDepotInput = {
  lat?: number | null;
  lon?: number | null;
  label?: string | null;
};

export type DeliveryIntelligenceStopInput = {
  stopId: string;
  label?: string | null;
  lat?: number | null;
  lon?: number | null;
  slotId?: string | null;
  orderCount?: number | null;
  windowStartMinutes?: number | null;
  windowEndMinutes?: number | null;
  priorityHint?: "urgent" | "high_volume" | "narrow_window" | "normal" | null;
};

export type DeliveryWindowInput = {
  slotId?: string | null;
  label?: string | null;
  startMinutes?: number | null;
  endMinutes?: number | null;
};

export type DeliveryIntelligenceInput = {
  depot?: DeliveryDepotInput | null;
  stops: DeliveryIntelligenceStopInput[];
  currentWindows?: DeliveryWindowInput[] | null;
  locale?: "nb" | "en" | null;
};

export type SuggestedDeliveryRoute = {
  stopIdsInOrder: string[];
  rationale: string;
  estimatedImprovementHint: string | null;
};

export type TimeWindowSuggestion = {
  slotId: string | null;
  suggestion: string;
  rationale: string;
};

export type StopPrioritization = {
  stopId: string;
  position: number;
  reason: string;
  priorityLabel: string | null;
};

export type DeliveryIntelligenceOutput = {
  suggestedRoute: SuggestedDeliveryRoute;
  timeWindowSuggestions: TimeWindowSuggestion[];
  prioritization: StopPrioritization[];
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

function dist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const NARROW_WINDOW_MINUTES = 45;

/**
 * Optimizes delivery plan: route order, time window suggestions, and prioritization. Deterministic.
 */
export function optimizeDeliveryPlan(
  input: DeliveryIntelligenceInput
): DeliveryIntelligenceOutput {
  const isEn = input.locale === "en";
  const stops = Array.isArray(input.stops) ? input.stops : [];
  const depot = input.depot ?? null;
  const depotLat = depot ? safeNum(depot.lat) : 0;
  const depotLon = depot ? safeNum(depot.lon) : 0;

  const haveCoords = stops.some(
    (s) => Number.isFinite(safeNum(s.lat)) && Number.isFinite(safeNum(s.lon))
  );

  type StopWithMeta = {
    stopId: string;
    lat: number;
    lon: number;
    orderCount: number;
    windowSpan: number;
    priorityHint: string | null;
  };

  const withMeta: StopWithMeta[] = stops.map((s) => {
    const start = safeNum(s.windowStartMinutes);
    const end = safeNum(s.windowEndMinutes);
    const windowSpan = end > start ? end - start : 0;
    const hint = s.priorityHint ?? null;
    return {
      stopId: safeStr(s.stopId),
      lat: safeNum(s.lat),
      lon: safeNum(s.lon),
      orderCount: Math.max(0, safeNum(s.orderCount)),
      windowSpan,
      priorityHint: typeof hint === "string" ? hint : null,
    };
  });

  let stopIdsInOrder: string[];
  let routeRationale: string;
  let improvementHint: string | null = null;

  if (haveCoords && withMeta.length > 0) {
    const startLat = depotLat !== 0 || depotLon !== 0 ? depotLat : withMeta[0]!.lat;
    const startLon = depotLat !== 0 || depotLon !== 0 ? depotLon : withMeta[0]!.lon;
    const remaining = withMeta.map((s) => ({ ...s }));
    const ordered: string[] = [];
    let curLat = startLat;
    let curLon = startLon;
    while (remaining.length > 0) {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = dist(curLat, curLon, remaining[i]!.lat, remaining[i]!.lon);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      const next = remaining.splice(best, 1)[0]!;
      ordered.push(next.stopId);
      curLat = next.lat;
      curLon = next.lon;
    }
    stopIdsInOrder = ordered;
    routeRationale = isEn
      ? "Route ordered by nearest-neighbor from depot to minimize travel distance."
      : "Rute sortert etter nærmeste nabo fra depot for å redusere kjørelengde.";
    improvementHint = isEn
      ? "This order typically reduces total distance and supports on-time delivery."
      : "Denne rekkefølgen reduserer ofte total kjørelengde og støtter levering i tide.";
  } else {
    stopIdsInOrder = withMeta.map((s) => s.stopId).filter(Boolean);
    routeRationale = isEn
      ? "No coordinates provided; order unchanged. Add lat/lon for route optimization."
      : "Ingen koordinater oppgitt; rekkefølge uendret. Legg inn lat/lon for ruteoptimalisering.";
  }

  const bySlot = new Map<string, DeliveryIntelligenceStopInput[]>();
  for (const s of stops) {
    const slot = safeStr(s.slotId) || "default";
    const list = bySlot.get(slot) ?? [];
    list.push(s);
    bySlot.set(slot, list);
  }

  const timeWindowSuggestions: TimeWindowSuggestion[] = [];
  if (bySlot.size > 1) {
    const slots = Array.from(bySlot.entries());
    const singleStopSlots = slots.filter(([, list]) => list.length === 1);
    if (singleStopSlots.length > 0) {
      timeWindowSuggestions.push({
        slotId: singleStopSlots[0]?.[0] ?? null,
        suggestion: isEn
          ? "Consider grouping single-stop slots with nearby time windows to reduce trips."
          : "Vurder å gruppere leveranser med én stopp med nærliggende vinduer for færre turer.",
        rationale: isEn
          ? "Fewer, consolidated windows can reduce total drive time."
          : "Færre, samlete vinduer kan redusere total kjøretid.",
      });
    }
  }
  if (stops.length >= 5) {
    timeWindowSuggestions.push({
      slotId: null,
      suggestion: isEn
        ? "Use 60–90 min delivery windows per area to balance flexibility and efficiency."
        : "Bruk 60–90 min leveringsvinduer per område for balanse mellom fleksibilitet og effektivitet.",
      rationale: isEn
        ? "Moderate window length helps drivers batch stops without over-tight constraints."
        : "Moderat vindulengde hjelper sjåfører med å gruppere stopp uten for stramme krav.",
    });
  }
  if (timeWindowSuggestions.length === 0) {
    timeWindowSuggestions.push({
      slotId: null,
      suggestion: isEn
        ? "Keep delivery windows consistent per area to simplify routing."
        : "Behold like leveringsvinduer per område for enklere ruteplanlegging.",
      rationale: isEn
        ? "Consistent windows support predictable and efficient routes."
        : "Like vinduer støtter forutsigbare og effektive ruter.",
    });
  }

  const metaByStop = new Map(withMeta.map((s) => [s.stopId, s]));
  const prioritization: StopPrioritization[] = stopIdsInOrder.map((stopId, index) => {
    const meta = metaByStop.get(stopId);
    const position = index + 1;
    let reason: string;
    let priorityLabel: string | null = null;
    if (meta?.priorityHint === "urgent") {
      priorityLabel = isEn ? "Urgent" : "Haster";
      reason = isEn
        ? "Prioritized first: marked urgent."
        : "Prioritert først: markert som haster.";
    } else if (meta?.priorityHint === "narrow_window" || (meta && meta.windowSpan > 0 && meta.windowSpan < NARROW_WINDOW_MINUTES)) {
      priorityLabel = isEn ? "Narrow window" : "Trangt vindu";
      reason = isEn
        ? "Do within narrow time window to avoid missed delivery."
        : "Lever innen trangt tidsvindu for å unngå tapt levering.";
    } else if (meta && meta.orderCount >= 10) {
      priorityLabel = isEn ? "High volume" : "Høyt volum";
      reason = isEn
        ? `High order count (${meta.orderCount}); prioritize to simplify loading and reduce wait.`
        : `Høyt antall bestillinger (${meta.orderCount}); prioriter for enklere lasting og kortere ventetid.`;
    } else if (index === 0) {
      reason = isEn
        ? "First stop: nearest to depot (or start point)."
        : "Første stopp: nærmest depot (eller startpunkt).";
    } else {
      reason = isEn
        ? "Order follows optimized route sequence."
        : "Rekkefølge følger optimalisert rutesekvens.";
    }
    return { stopId, position, reason, priorityLabel };
  });

  const summary = isEn
    ? `Delivery plan: route with ${stopIdsInOrder.length} stops, ${timeWindowSuggestions.length} time-window suggestion(s), prioritization for each stop.`
    : `Leveringsplan: rute med ${stopIdsInOrder.length} stopp, ${timeWindowSuggestions.length} forslag til tidsvinduer, prioritering per stopp.`;

  return {
    suggestedRoute: {
      stopIdsInOrder,
      rationale: routeRationale,
      estimatedImprovementHint: improvementHint,
    },
    timeWindowSuggestions,
    prioritization,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

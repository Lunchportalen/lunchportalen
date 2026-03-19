/**
 * AI Delivery Route Intelligence capability: suggestRouteAndWindows.
 * AI analyserer leveranser og foreslår: mer effektive ruter, bedre leveringsvinduer.
 * Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "deliveryRouteIntelligence";

const deliveryRouteIntelligenceCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Delivery route intelligence: analyzes deliveries and suggests more efficient routes and better delivery windows. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Delivery route intelligence input",
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
          },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["stops"],
  },
  outputSchema: {
    type: "object",
    description: "Suggested route and delivery windows",
    required: ["suggestedRoute", "windowSuggestions", "summary", "generatedAt"],
    properties: {
      suggestedRoute: { type: "object" },
      windowSuggestions: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "suggestion_only",
      description: "Output is route and window suggestions only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api", "driver"],
};

registerCapability(deliveryRouteIntelligenceCapability);

export type DepotInput = {
  lat?: number | null;
  lon?: number | null;
  label?: string | null;
};

export type DeliveryStopInput = {
  stopId: string;
  label?: string | null;
  lat?: number | null;
  lon?: number | null;
  slotId?: string | null;
  orderCount?: number | null;
};

export type DeliveryRouteIntelligenceInput = {
  depot?: DepotInput | null;
  stops: DeliveryStopInput[];
  locale?: "nb" | "en" | null;
};

export type SuggestedRouteOutput = {
  stopIdsInOrder: string[];
  rationale: string;
  estimatedImprovementHint: string | null;
};

export type WindowSuggestion = {
  slotId: string | null;
  suggestion: string;
  rationale: string;
};

export type DeliveryRouteIntelligenceOutput = {
  suggestedRoute: SuggestedRouteOutput;
  windowSuggestions: WindowSuggestion[];
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

/**
 * Suggests more efficient route order and better delivery windows. Deterministic.
 */
export function suggestRouteAndWindows(
  input: DeliveryRouteIntelligenceInput
): DeliveryRouteIntelligenceOutput {
  const isEn = input.locale === "en";
  const stops = Array.isArray(input.stops) ? input.stops : [];
  const depot = input.depot ?? null;
  const depotLat = depot ? safeNum(depot.lat) : 0;
  const depotLon = depot ? safeNum(depot.lon) : 0;

  const haveCoords = stops.some(
    (s) => Number.isFinite(safeNum(s.lat)) && Number.isFinite(safeNum(s.lon))
  );

  let stopIdsInOrder: string[];
  let routeRationale: string;
  let improvementHint: string | null = null;

  if (haveCoords && stops.length > 0) {
    const withCoords = stops.map((s) => ({
      stopId: safeStr(s.stopId),
      lat: safeNum(s.lat),
      lon: safeNum(s.lon),
    }));
    const startLat = depotLat !== 0 || depotLon !== 0 ? depotLat : withCoords[0]!.lat;
    const startLon = depotLat !== 0 || depotLon !== 0 ? depotLon : withCoords[0]!.lon;
    const remaining = [...withCoords];
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
      ? "Following this order typically reduces total distance vs. arbitrary sequence."
      : "Denne rekkefølgen reduserer ofte total kjørelengde sammenlignet med vilkårlig rekkefølge.";
  } else {
    stopIdsInOrder = stops.map((s) => safeStr(s.stopId)).filter(Boolean);
    routeRationale = isEn
      ? "No coordinates provided; order unchanged. Add lat/lon for route optimization."
      : "Ingen koordinater oppgitt; rekkefølge uendret. Legg inn lat/lon for ruteoptimalisering.";
  }

  const windowSuggestions: WindowSuggestion[] = [];
  const bySlot = new Map<string, DeliveryStopInput[]>();
  for (const s of stops) {
    const slot = safeStr(s.slotId) || "default";
    const list = bySlot.get(slot) ?? [];
    list.push(s);
    bySlot.set(slot, list);
  }
  if (bySlot.size > 1) {
    const slots = Array.from(bySlot.entries());
    if (slots.some(([, list]) => list.length === 1)) {
      const smallSlots = slots.filter(([, list]) => list.length === 1);
      windowSuggestions.push({
        slotId: smallSlots[0]?.[0] ?? null,
        suggestion: isEn
          ? "Consider grouping single-stop slots with nearby time windows to reduce trips."
          : "Vurder å gruppere leveranser med én stopp med nærliggende vinduer for færre turer.",
        rationale: isEn
          ? "Fewer, consolidated windows can reduce total drive time and simplify planning."
          : "Færre, samlete vinduer kan redusere total kjøretid og forenkle planlegging.",
      });
    }
  }
  if (stops.length >= 5) {
    windowSuggestions.push({
      slotId: null,
      suggestion: isEn
        ? "Use 60–90 min delivery windows per area to balance flexibility and efficiency."
        : "Bruk 60–90 min leveringsvinduer per område for balanse mellom fleksibilitet og effektivitet.",
      rationale: isEn
        ? "Moderate window length helps drivers batch stops without over-tight constraints."
        : "Moderat vindulengde hjelper sjåfører med å gruppere stopp uten for stramme krav.",
    });
  }
  if (windowSuggestions.length === 0) {
    windowSuggestions.push({
      slotId: null,
      suggestion: isEn
        ? "Keep delivery windows consistent per area to simplify routing."
        : "Behold like leveringsvinduer per område for enklere ruteplanlegging.",
      rationale: isEn
        ? "Consistent windows support predictable and efficient routes."
        : "Like vinduer støtter forutsigbare og effektive ruter.",
    });
  }

  const summary = isEn
    ? `Suggested route with ${stopIdsInOrder.length} stops; ${windowSuggestions.length} window suggestion(s). Use for more efficient deliveries.`
    : `Foreslått rute med ${stopIdsInOrder.length} stopp; ${windowSuggestions.length} forslag til leveringsvinduer. Bruk for mer effektive leveranser.`;

  return {
    suggestedRoute: {
      stopIdsInOrder,
      rationale: routeRationale,
      estimatedImprovementHint: improvementHint,
    },
    windowSuggestions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

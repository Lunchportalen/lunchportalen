/**
 * AI Kitchen Risk Detector capability: detectKitchenRisks.
 * Oppdager risiko som: volumspike, forsinkelse, underkapasitet.
 * Deterministic; no LLM.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "kitchenRiskDetector";

const kitchenRiskDetectorCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Kitchen risk detector: detects risks such as volume spike, delay, and undercapacity. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Kitchen risk detector input",
    properties: {
      slots: {
        type: "array",
        description: "Slots or days with planned orders, capacity, and optional history",
        items: {
          type: "object",
          properties: {
            slotId: { type: "string" },
            slotLabel: { type: "string" },
            date: { type: "string" },
            plannedOrders: { type: "number" },
            capacity: { type: "number" },
            averageHistoricalOrders: { type: "number" },
            recentDelayPercent: { type: "number", description: "0-100, recent delivery delay rate" },
          },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["slots"],
  },
  outputSchema: {
    type: "object",
    description: "Detected kitchen risks",
    required: ["risks", "summary", "generatedAt"],
    properties: {
      risks: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "detection_only",
      description: "Output is risk detection only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api", "kitchen"],
};

registerCapability(kitchenRiskDetectorCapability);

export type KitchenSlotInput = {
  slotId: string;
  slotLabel?: string | null;
  date?: string | null;
  plannedOrders: number;
  capacity: number;
  averageHistoricalOrders?: number | null;
  recentDelayPercent?: number | null;
};

export type KitchenRiskDetectorInput = {
  slots: KitchenSlotInput[];
  locale?: "nb" | "en" | null;
};

export type KitchenRiskType = "delay_risk" | "volume_spike" | "undercapacity";

export type DetectedKitchenRisk = {
  type: KitchenRiskType;
  slotId: string | null;
  slotLabel: string | null;
  date: string | null;
  severity: "high" | "medium" | "low";
  description: string;
  suggestedAction: string;
  valueHint: string | null;
};

export type KitchenRiskDetectorOutput = {
  risks: DetectedKitchenRisk[];
  summary: string;
  generatedAt: string;
};

const DELAY_RISK_THRESHOLD = 15;
const DELAY_RISK_HIGH = 30;
const SPIKE_FACTOR = 1.4;
const SPIKE_HIGH_FACTOR = 1.7;
const UNDERCAPACITY_UTILIZATION = 0.95;
const UNDERCAPACITY_HIGH = 1.05;

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Detects kitchen risks: delay risk, volume spikes, undercapacity. Deterministic.
 */
export function detectKitchenRisks(input: KitchenRiskDetectorInput): KitchenRiskDetectorOutput {
  const isEn = input.locale === "en";
  const slots = Array.isArray(input.slots) ? input.slots : [];
  const risks: DetectedKitchenRisk[] = [];

  for (const slot of slots) {
    const slotId = safeStr(slot.slotId);
    const slotLabel = safeStr(slot.slotLabel) || slotId || null;
    const date = slot.date ? safeStr(slot.date) : null;
    const planned = Math.max(0, safeNum(slot.plannedOrders));
    const capacity = Math.max(0, safeNum(slot.capacity));
    const historical = Math.max(0, safeNum(slot.averageHistoricalOrders));
    const delayPercent = Math.min(100, Math.max(0, safeNum(slot.recentDelayPercent)));

    if (capacity > 0 && planned > capacity) {
      const overBy = planned - capacity;
      const utilization = planned / capacity;
      const severity: "high" | "medium" | "low" =
        utilization >= UNDERCAPACITY_HIGH ? "high" : utilization >= UNDERCAPACITY_UTILIZATION ? "medium" : "low";
      risks.push({
        type: "undercapacity",
        slotId: slotId || null,
        slotLabel,
        date,
        severity,
        description: isEn
          ? `Planned orders (${planned}) exceed capacity (${capacity}); shortfall ${overBy}.`
          : `Planlagte bestillinger (${planned}) overstiger kapasitet (${capacity}); underkapasitet ${overBy}.`,
        suggestedAction: isEn
          ? "Increase capacity, shift orders to another slot/kitchen, or extend preparation time."
          : "Øk kapasitet, flytt bestillinger til annet vindu/kjøkken, eller forleng tilberedningstid.",
        valueHint: `${planned} / ${capacity} (${Math.round(utilization * 100)} %)`,
      });
    }

    if (historical > 0 && planned > 0) {
      const ratio = planned / historical;
      if (ratio >= SPIKE_HIGH_FACTOR) {
        risks.push({
          type: "volume_spike",
          slotId: slotId || null,
          slotLabel,
          date,
          severity: "high",
          description: isEn
            ? `Volume spike: planned ${planned} is ${Math.round((ratio - 1) * 100)}% above average (${historical}).`
            : `Volumspike: planlagt ${planned} er ${Math.round((ratio - 1) * 100)} % over snitt (${historical}).`,
          suggestedAction: isEn
            ? "Confirm capacity and staffing; consider splitting delivery window or adding prep capacity."
            : "Bekreft kapasitet og bemanning; vurder å dele leveringsvindu eller øke tilberedningskapasitet.",
          valueHint: `${planned} vs snitt ${historical}`,
        });
      } else if (ratio >= SPIKE_FACTOR) {
        risks.push({
          type: "volume_spike",
          slotId: slotId || null,
          slotLabel,
          date,
          severity: "medium",
          description: isEn
            ? `Elevated volume: planned ${planned} is above usual (${historical}).`
            : `Forhøyet volum: planlagt ${planned} er over vanlig (${historical}).`,
          suggestedAction: isEn
            ? "Monitor and ensure capacity can handle the increase."
            : "Overvåk og sørg for at kapasiteten takler økningen.",
          valueHint: `${planned} vs snitt ${historical}`,
        });
      }
    }

    if (delayPercent >= DELAY_RISK_THRESHOLD) {
      const severity: "high" | "medium" | "low" =
        delayPercent >= DELAY_RISK_HIGH ? "high" : delayPercent >= DELAY_RISK_THRESHOLD ? "medium" : "low";
      risks.push({
        type: "delay_risk",
        slotId: slotId || null,
        slotLabel,
        date,
        severity,
        description: isEn
          ? `Recent delay rate ${Math.round(delayPercent)}%; risk of delivery delays.`
          : `Nylig forsinkelsesandel ${Math.round(delayPercent)} %; risiko for leveringsforsinkelser.`,
        suggestedAction: isEn
          ? "Review prep timing, delivery routes, and order deadlines; add buffer or resources."
          : "Gjennomgå tilberedningstid, leveringsruter og bestillingsfrister; legg inn buffer eller ressurser.",
        valueHint: `${Math.round(delayPercent)} % forsinket`,
      });
    }
  }

  const highCount = risks.filter((r) => r.severity === "high").length;
  const summary = isEn
    ? `Detected ${risks.length} kitchen risk(s); ${highCount} high severity. Address to avoid delays and overload.`
    : `Oppdaget ${risks.length} kjøkkenrisiko(er); ${highCount} høy alvorlighet. Adresser for å unngå forsinkelser og overbelastning.`;

  return {
    risks,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

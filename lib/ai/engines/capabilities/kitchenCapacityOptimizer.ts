/**
 * AI Kitchen Capacity Optimizer capability: optimizeKitchenCapacity.
 * AI sørger for at kjøkkenet ikke overbelastes.
 * Kan foreslå: endret leveringsvindu, volumjustering.
 * Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "kitchenCapacityOptimizer";

const kitchenCapacityOptimizerCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Kitchen capacity optimizer: ensures kitchen is not overloaded. Suggests changed delivery window or volume adjustment. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Kitchen capacity optimizer input",
    properties: {
      slots: {
        type: "array",
        description: "Slots/windows with capacity and planned orders",
        items: {
          type: "object",
          properties: {
            slotId: { type: "string" },
            slotLabel: { type: "string" },
            date: { type: "string" },
            deliveryWindowLabel: { type: "string" },
            capacity: { type: "number" },
            plannedOrders: { type: "number" },
          },
        },
      },
      alternativeWindows: {
        type: "array",
        description: "Optional alternative delivery windows (same day/kitchen) for shift suggestions",
        items: {
          type: "object",
          properties: {
            windowId: { type: "string" },
            label: { type: "string" },
            date: { type: "string" },
            capacity: { type: "number" },
            currentLoad: { type: "number" },
          },
        },
      },
      periodLabel: { type: "string" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["slots"],
  },
  outputSchema: {
    type: "object",
    description: "Capacity optimization suggestions",
    required: [
      "deliveryWindowSuggestions",
      "volumeAdjustments",
      "summary",
      "generatedAt",
    ],
    properties: {
      deliveryWindowSuggestions: { type: "array", items: { type: "object" } },
      volumeAdjustments: { type: "array", items: { type: "object" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "suggestions_only",
      description: "Output is optimization suggestions only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api", "kitchen"],
};

registerCapability(kitchenCapacityOptimizerCapability);

export type CapacitySlotInput = {
  slotId: string;
  slotLabel?: string | null;
  date?: string | null;
  deliveryWindowLabel?: string | null;
  capacity: number;
  plannedOrders: number;
};

export type AlternativeWindowInput = {
  windowId: string;
  label?: string | null;
  date?: string | null;
  capacity: number;
  currentLoad?: number | null;
};

export type KitchenCapacityOptimizerInput = {
  slots: CapacitySlotInput[];
  alternativeWindows?: AlternativeWindowInput[] | null;
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
};

export type DeliveryWindowSuggestion = {
  fromSlotId: string | null;
  fromSlotLabel: string | null;
  fromWindowLabel: string | null;
  toWindowId: string | null;
  toWindowLabel: string | null;
  reason: string;
  ordersToMoveHint: number | null;
};

export type VolumeAdjustment = {
  slotId: string | null;
  slotLabel: string | null;
  date: string | null;
  currentPlanned: number;
  suggestedMax: number;
  reason: string;
};

export type KitchenCapacityOptimizerOutput = {
  deliveryWindowSuggestions: DeliveryWindowSuggestion[];
  volumeAdjustments: VolumeAdjustment[];
  summary: string;
  generatedAt: string;
};

const OVERLOAD_THRESHOLD = 1.0; // suggest when planned >= capacity
const VOLUME_HEADROOM = 0.95; // suggest max at 95% of capacity when over

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Suggests delivery window changes and volume adjustments so kitchen is not overloaded. Deterministic.
 */
export function optimizeKitchenCapacity(
  input: KitchenCapacityOptimizerInput
): KitchenCapacityOptimizerOutput {
  const isEn = input.locale === "en";
  const slots = Array.isArray(input.slots) ? input.slots : [];
  const alternatives = Array.isArray(input.alternativeWindows) ? input.alternativeWindows : [];
  const deliveryWindowSuggestions: DeliveryWindowSuggestion[] = [];
  const volumeAdjustments: VolumeAdjustment[] = [];

  for (const slot of slots) {
    const slotId = safeStr(slot.slotId);
    const slotLabel = safeStr(slot.slotLabel) || slotId || null;
    const date = slot.date ? safeStr(slot.date) : null;
    const windowLabel = safeStr(slot.deliveryWindowLabel) || null;
    const capacity = Math.max(0, safeNum(slot.capacity));
    const planned = Math.max(0, safeNum(slot.plannedOrders));

    if (capacity <= 0) continue;

    const isOverloaded = planned >= capacity;
    const overBy = Math.max(0, planned - capacity);

    if (isOverloaded) {
      // Volume adjustment: suggest cap at VOLUME_HEADROOM * capacity
      const suggestedMax = Math.max(0, Math.floor(capacity * VOLUME_HEADROOM));
      volumeAdjustments.push({
        slotId: slotId || null,
        slotLabel,
        date,
        currentPlanned: planned,
        suggestedMax,
        reason: isEn
          ? `Planned (${planned}) exceeds capacity (${capacity}). Consider capping at ${suggestedMax} or shifting delivery window.`
          : `Planlagt (${planned}) overstiger kapasitet (${capacity}). Vurder å begrense til ${suggestedMax} eller flytte leveringsvindu.`,
      });

      // If we have alternatives with headroom, suggest moving some orders
      const slotDate = date || "";
      for (const alt of alternatives) {
        const altDate = alt.date ? safeStr(alt.date) : "";
        if (altDate && slotDate && altDate !== slotDate) continue;
        const altCapacity = Math.max(0, safeNum(alt.capacity));
        const altLoad = Math.max(0, safeNum(alt.currentLoad));
        const headroom = Math.max(0, altCapacity - altLoad);
        if (headroom > 0 && overBy > 0) {
          const moveHint = Math.min(overBy, headroom);
          deliveryWindowSuggestions.push({
            fromSlotId: slotId || null,
            fromSlotLabel: slotLabel,
            fromWindowLabel: windowLabel,
            toWindowId: safeStr(alt.windowId) || null,
            toWindowLabel: safeStr(alt.label) || null,
            reason: isEn
              ? `Shift up to ${moveHint} orders to "${safeStr(alt.label) || alt.windowId}" to avoid overload (capacity ${altCapacity}, current ${altLoad}).`
              : `Flytt inntil ${moveHint} bestillinger til «${safeStr(alt.label) || alt.windowId}» for å unngå overbelastning (kapasitet ${altCapacity}, nå ${altLoad}).`,
            ordersToMoveHint: moveHint,
          });
          break; // one alternative suggestion per overloaded slot
        }
      }

      // If no alternative suggested for this slot, add a generic "change window" hint
      const hasSuggestionForSlot = deliveryWindowSuggestions.some(
        (s) => s.fromSlotId === (slotId || null)
      );
      if (!hasSuggestionForSlot) {
        deliveryWindowSuggestions.push({
          fromSlotId: slotId || null,
          fromSlotLabel: slotLabel,
          fromWindowLabel: windowLabel,
          toWindowId: null,
          toWindowLabel: null,
          reason: isEn
            ? `Slot "${slotLabel || slotId}" is over capacity. Consider moving some orders to another delivery window if available.`
            : `Vindu «${slotLabel || slotId}» er over kapasitet. Vurder å flytte noen bestillinger til et annet leveringsvindu dersom tilgjengelig.`,
          ordersToMoveHint: overBy,
        });
      }
    }
  }

  const dwCount = deliveryWindowSuggestions.length;
  const volCount = volumeAdjustments.length;
  const summary = isEn
    ? `Kitchen capacity optimizer: ${volCount} volume adjustment(s), ${dwCount} delivery window suggestion(s). Apply to avoid overload.`
    : `Kjøkkenkapasitet-optimalisering: ${volCount} volumjustering(er), ${dwCount} forslag til endret leveringsvindu. Bruk for å unngå overbelastning.`;

  return {
    deliveryWindowSuggestions,
    volumeAdjustments,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

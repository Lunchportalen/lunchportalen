/**
 * AI Kitchen Load Balancer capability: balanceKitchenLoad.
 * AI balanserer produksjon mellom kjøkken.
 * Hvis flere leverandører finnes kan AI: fordele ordre, redusere flaskehalser.
 * Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "kitchenLoadBalancer";

const kitchenLoadBalancerCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Kitchen load balancer: balances production across kitchens. With multiple suppliers, suggests order distribution to reduce bottlenecks. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Kitchen load balancer input",
    properties: {
      kitchens: {
        type: "array",
        description: "Kitchens/suppliers with capacity",
        items: {
          type: "object",
          properties: {
            kitchenId: { type: "string" },
            name: { type: "string" },
            capacityOrdersPerDay: { type: "number" },
            currentLoad: { type: "number", description: "Already assigned orders today" },
          },
        },
      },
      totalDemand: {
        type: "number",
        description: "Total orders to assign for the period/slot",
      },
      periodLabel: { type: "string", description: "e.g. single day, 2024-03-15" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["kitchens", "totalDemand"],
  },
  outputSchema: {
    type: "object",
    description: "Load balance output",
    required: ["allocations", "bottlenecks", "summary", "generatedAt"],
    properties: {
      allocations: { type: "array", items: { type: "object" } },
      bottlenecks: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "suggestion_only",
      description: "Output is allocation suggestion only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api", "kitchen"],
};

registerCapability(kitchenLoadBalancerCapability);

export type KitchenInput = {
  kitchenId: string;
  name?: string | null;
  capacityOrdersPerDay: number;
  currentLoad?: number | null;
};

export type KitchenLoadBalancerInput = {
  kitchens: KitchenInput[];
  totalDemand: number;
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
};

export type KitchenAllocation = {
  kitchenId: string;
  kitchenName: string;
  assignedOrders: number;
  totalAfterAssignment: number;
  capacity: number;
  utilizationPercent: number;
  atCapacity: boolean;
  rationale: string;
};

export type KitchenLoadBalancerOutput = {
  allocations: KitchenAllocation[];
  bottlenecks: string[];
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
 * Balances order load across kitchens to reduce bottlenecks. Deterministic.
 */
export function balanceKitchenLoad(input: KitchenLoadBalancerInput): KitchenLoadBalancerOutput {
  const isEn = input.locale === "en";
  const kitchens = Array.isArray(input.kitchens) ? input.kitchens : [];
  const totalDemand = Math.max(0, safeNum(input.totalDemand));
  const periodLabel = safeStr(input.periodLabel) || (isEn ? "period" : "perioden");

  const valid = kitchens.filter(
    (k) => safeStr(k.kitchenId) && safeNum(k.capacityOrdersPerDay) > 0
  );

  if (valid.length === 0) {
    return {
      allocations: [],
      bottlenecks: [
        isEn
          ? "No kitchens with valid capacity; add kitchens and capacity."
          : "Ingen kjøkken med gyldig kapasitet; legg inn kjøkken og kapasitet.",
      ],
      summary: isEn
        ? "No allocation possible."
        : "Ingen fordeling mulig.",
      generatedAt: new Date().toISOString(),
    };
  }

  const totalCapacity = valid.reduce((s, k) => s + safeNum(k.capacityOrdersPerDay), 0);
  const currentLoads = valid.map((k) => ({
    kitchenId: safeStr(k.kitchenId),
    name: safeStr(k.name) || k.kitchenId,
    capacity: safeNum(k.capacityOrdersPerDay),
    current: safeNum(k.currentLoad),
  }));

  const totalCurrent = currentLoads.reduce((s, k) => s + k.current, 0);
  const demandToAssign = totalDemand;
  const totalAfter = totalCurrent + demandToAssign;

  const allocations: KitchenAllocation[] = [];
  const bottlenecks: string[] = [];

  if (totalCapacity <= 0) {
    return {
      allocations: [],
      bottlenecks: [isEn ? "Total capacity is zero." : "Total kapasitet er null."],
      summary: isEn ? "No capacity to allocate." : "Ingen kapasitet å fordele.",
      generatedAt: new Date().toISOString(),
    };
  }

  const proportional = currentLoads.map((k) => ({
    ...k,
    targetOrders: (k.capacity / totalCapacity) * totalAfter,
  }));

  let remaining = demandToAssign;
  const assigned = new Map<string, number>();
  for (const k of currentLoads) {
    assigned.set(k.kitchenId, k.current);
  }

  const byUnderTarget = [...proportional].sort(
    (a, b) => (b.targetOrders - b.current) - (a.targetOrders - a.current)
  );

  for (const k of byUnderTarget) {
    if (remaining <= 0) break;
    const current = assigned.get(k.kitchenId) ?? 0;
    const spare = Math.max(0, k.capacity - current);
    const toAssign = Math.min(remaining, Math.round(k.targetOrders - current));
    const actualAssign = Math.max(0, Math.min(toAssign, spare, remaining));
    assigned.set(k.kitchenId, current + actualAssign);
    remaining -= actualAssign;
  }

  if (remaining > 0) {
    for (const k of byUnderTarget) {
      if (remaining <= 0) break;
      const current = assigned.get(k.kitchenId) ?? 0;
      const spare = Math.max(0, k.capacity - current);
      const extra = Math.min(remaining, spare);
      if (extra > 0) {
        assigned.set(k.kitchenId, current + extra);
        remaining -= extra;
      }
    }
  }

  for (const k of currentLoads) {
    const total = assigned.get(k.kitchenId) ?? k.current;
    const added = total - k.current;
    const utilizationPercent =
      k.capacity > 0 ? Math.round((total / k.capacity) * 1000) / 10 : 0;
    const atCapacity = total >= k.capacity;
    if (atCapacity && total > k.capacity) {
      bottlenecks.push(
        isEn
          ? `${k.name}: over capacity (${total} > ${k.capacity})`
          : `${k.name}: over kapasitet (${total} > ${k.capacity})`
      );
    }
    allocations.push({
      kitchenId: k.kitchenId,
      kitchenName: k.name,
      assignedOrders: added,
      totalAfterAssignment: total,
      capacity: k.capacity,
      utilizationPercent,
      atCapacity,
      rationale:
        added <= 0
          ? isEn
            ? "No additional load; already at or over target."
            : "Ingen ekstra belastning; allerede på eller over mål."
          : isEn
            ? `+${added} orders to balance load (${utilizationPercent}% util).`
            : `+${added} bestillinger for å balansere (${utilizationPercent} % utnyttelse).`,
    });
  }

  if (remaining > 0) {
    bottlenecks.push(
      isEn
        ? `Total demand (${totalDemand}) exceeds total capacity (${totalCapacity}). Consider adding capacity or reducing demand.`
        : `Total etterspørsel (${totalDemand}) overstiger total kapasitet (${totalCapacity}). Vurder mer kapasitet eller redusert volum.`
    );
  }

  const summary =
    isEn
      ? `Balanced ${totalDemand} orders across ${valid.length} kitchen(s) for ${periodLabel}. ${bottlenecks.length > 0 ? "Bottlenecks: see list." : "No over-capacity."}`
      : `Fordelt ${totalDemand} bestillinger på ${valid.length} kjøkken for ${periodLabel}. ${bottlenecks.length > 0 ? "Flaskehalser: se liste." : "Ingen over kapasitet."}`;

  return {
    allocations,
    bottlenecks,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

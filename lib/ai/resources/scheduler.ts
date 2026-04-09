import type { CapacityAllocationRow } from "@/lib/ai/resources/capacityEngine";

export type ScheduledAllocationRow = CapacityAllocationRow & {
  scheduledAt: string;
};

const STAGGER_MS = 60_000;

export function scheduleActions(allocations: CapacityAllocationRow[], nowMs: number = Date.now()): ScheduledAllocationRow[] {
  return allocations.map((a, i) => ({
    ...a,
    scheduledAt: new Date(nowMs + i * STAGGER_MS).toISOString(),
  }));
}

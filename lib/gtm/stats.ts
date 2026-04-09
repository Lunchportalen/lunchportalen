import "server-only";

import { opsLog } from "@/lib/ops/log";

type GtmCounters = {
  leadsProcessed: number;
  dealsCreated: number;
  revenueAttributed: number;
};

let counters: GtmCounters = { leadsProcessed: 0, dealsCreated: 0, revenueAttributed: 0 };

export function recordGtmRun(partial: Partial<GtmCounters>): void {
  counters = {
    leadsProcessed: counters.leadsProcessed + (partial.leadsProcessed ?? 0),
    dealsCreated: counters.dealsCreated + (partial.dealsCreated ?? 0),
    revenueAttributed: counters.revenueAttributed + (partial.revenueAttributed ?? 0),
  };
  opsLog("gtm_counters", { ...counters });
}

export function getGtmEngineMetrics(): { leads: number; deals: number; revenue: number } {
  return {
    leads: counters.leadsProcessed,
    deals: counters.dealsCreated,
    revenue: counters.revenueAttributed,
  };
}

/** Tester / rollback av prosess-minne (ikke persistent data). */
export function resetGtmStatsForTests(): void {
  counters = { leadsProcessed: 0, dealsCreated: 0, revenueAttributed: 0 };
}

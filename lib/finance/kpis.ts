import { num } from "@/lib/finance/numbers";

export type OrderLike = {
  line_total?: unknown;
  /** Bakoverkompatibilitet dersom eldre kode bruker annet navn */
  total_amount?: unknown;
};

export type PipelineDealLike = {
  value: number;
  probability: number;
};

export type KPIResult = {
  /** Sum faktisk ordreomsetning (line_total / total_amount). */
  revenue: number;
  deals: number;
  /** Vektet pipeline (verdi × sannsynlighet per rad). */
  weightedPipeline: number;
  /** Sum nominell pipeline-verdi (value_estimate). */
  pipelineGross: number;
};

/**
 * Deterministisk KPI-lag — ingen skjulte korreksjoner.
 */
export function computeKPIs(input: { orders: OrderLike[]; pipelineDeals: PipelineDealLike[] }): KPIResult {
  const orders = Array.isArray(input.orders) ? input.orders : [];
  const dealsIn = Array.isArray(input.pipelineDeals) ? input.pipelineDeals : [];

  const revenue = orders.reduce((sum, o) => sum + num(o.line_total ?? o.total_amount), 0);
  const deals = dealsIn.length;
  const weightedPipeline = dealsIn.reduce((sum, d) => {
    const v = Number.isFinite(d.value) ? d.value : 0;
    const p = Number.isFinite(d.probability) ? d.probability : 0;
    return sum + v * p;
  }, 0);
  const pipelineGross = dealsIn.reduce((sum, d) => sum + (Number.isFinite(d.value) ? d.value : 0), 0);

  return { revenue, deals, weightedPipeline, pipelineGross };
}

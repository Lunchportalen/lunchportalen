import "server-only";

import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { buildProfitState, profitInputsFromBusinessMetrics } from "@/lib/ai/profit/profitState";
import { opsLog } from "@/lib/ops/log";

export type ProfitEngineInput = {
  revenue?: number;
  costPerCustomer?: number;
  churn?: number;
  usage?: {
    ordersPerDay?: number;
    sessionsPerDay?: number;
    featureAdoptionScore?: number;
  };
  /** Distinct paying or active customers (if unknown, omit). */
  activeCustomerCount?: number;
  activeCompanyCount?: number;
};

export type ProfitEngineResult = {
  profitPerCustomer: number;
  profitPerCompany: number;
  margin: number;
  aggregateProfit: number;
  revenueProxy: number;
  costProxy: number;
  highValueSegments: string[];
  explain: string[];
};

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Deterministic P&L-style view from explicit inputs (no auto billing).
 * When counts are missing, scales are explainable proxies only.
 */
export function calculateProfit(input: ProfitEngineInput): ProfitEngineResult {
  const revenue = Math.max(0, safeNum(input.revenue ?? 0));
  const cpc = Math.max(0, safeNum(input.costPerCustomer ?? 0));
  const churn = Math.min(1, Math.max(0, safeNum(input.churn ?? 0)));
  const customers = Math.max(1, Math.floor(safeNum(input.activeCustomerCount ?? 0)) || 1);
  const companies = Math.max(1, Math.floor(safeNum(input.activeCompanyCount ?? 1)) || 1);

  const usageCost =
    safeNum(input.usage?.sessionsPerDay ?? 0) * 0.02 +
    safeNum(input.usage?.ordersPerDay ?? 0) * 0.05 +
    (1 - safeNum(input.usage?.featureAdoptionScore ?? 0.5)) * 0.1;

  const totalCost = customers * cpc + usageCost * customers + churn * revenue * 0.25;
  const aggregateProfit = revenue - totalCost;
  const margin = revenue > 0 ? aggregateProfit / revenue : 0;

  const profitPerCustomer = aggregateProfit / customers;
  const profitPerCompany = aggregateProfit / companies;

  const highValueSegments: string[] = [];
  if (margin > 0.35) highValueSegments.push("margin_over_35pct_proxy");
  if (churn < 0.08) highValueSegments.push("low_churn_proxy");
  if (safeNum(input.usage?.featureAdoptionScore) > 0.7) highValueSegments.push("strong_feature_adoption_proxy");

  const explain = [
    `inntekt_proxy=${revenue.toFixed(4)}`,
    `kost_per_kunde_inndata=${cpc.toFixed(4)}`,
    `aktive_kunder_estimat=${customers}`,
    `selskaper_estimat=${companies}`,
    `churn=${churn.toFixed(4)}`,
    `margin=${margin.toFixed(4)}`,
  ];

  return {
    profitPerCustomer,
    profitPerCompany,
    margin,
    aggregateProfit,
    revenueProxy: revenue,
    costProxy: totalCost,
    highValueSegments,
    explain,
  };
}

export type ProfitFromMetricsResult = ProfitEngineResult & { basedOn: "business_metrics"; rid: string };

/**
 * Uses {@link getBusinessMetrics} + existing profit state helpers — still proxy-level until ledger wiring.
 */
export async function calculateProfitFromMetrics(rid: string): Promise<ProfitFromMetricsResult> {
  try {
    const m = await getBusinessMetrics();
    const pi = profitInputsFromBusinessMetrics(m);
    const state = buildProfitState(pi);
    const activity = Math.max(1, Math.floor(Math.sqrt(m.eventRowsSampled + m.revenueRowsSampled + 1)));

    const revenue = state.revenue;
    const customers = activity;
    const companies = Math.max(1, Math.min(50, Math.ceil(activity / 5)));

    const res = calculateProfit({
      revenue,
      costPerCustomer: state.cost / Math.max(customers, 1),
      churn: state.churn,
      usage: {
        sessionsPerDay: m.eventRowsSampled / 30,
        featureAdoptionScore: m.conversionRate,
      },
      activeCustomerCount: customers,
      activeCompanyCount: companies,
    });

    return {
      ...res,
      basedOn: "business_metrics",
      rid,
      explain: [
        ...res.explain,
        `event_rows_sampled=${m.eventRowsSampled}`,
        `revenue_rows_sampled=${m.revenueRowsSampled}`,
        `conversionRate=${m.conversionRate.toFixed(4)}`,
        `revenueGrowth=${m.revenueGrowth.toFixed(4)}`,
      ],
    };
  } catch (e) {
    opsLog("profit.engine.metrics_failed", { rid, message: e instanceof Error ? e.message : String(e) });
    const fallback = calculateProfit({ revenue: 0, costPerCustomer: 0, churn: 0, activeCustomerCount: 1, activeCompanyCount: 1 });
    return {
      ...fallback,
      basedOn: "business_metrics",
      rid,
      explain: [...fallback.explain, "metrics_load_failed_fallback"],
    };
  }
}

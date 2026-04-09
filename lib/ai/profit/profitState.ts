import type { BusinessMetricsSnapshot } from "@/lib/ai/businessMetrics";

export type ProfitStateInput = {
  revenue?: number;
  cost?: number;
  churn?: number;
  cac?: number;
  ltv?: number;
};

export type ProfitState = {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  churn: number;
  cac: number;
  ltv: number;
  timestamp: number;
};

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Deterministic composite from {@link BusinessMetricsSnapshot} until ledger-grade P&L is wired.
 * Explainable proxies: conversion + growth → revenue signal; inverse conversion + churn → cost pressure.
 */
export function profitInputsFromBusinessMetrics(m: BusinessMetricsSnapshot): ProfitStateInput {
  const conversion = Math.min(1, Math.max(0, safeNum(m.conversionRate)));
  const growth = safeNum(m.revenueGrowth);
  const churn = Math.min(1, Math.max(0, safeNum(m.churnRate)));
  const revenue = Math.max(0, growth + conversion);
  const cost = Math.max(0, (1 - conversion) * 50 + churn * 100 + safeNum(m.eventRowsSampled) * 1e-6);
  const cac = 1 / Math.max(conversion, 0.0001);
  const ltv = conversion * cac * 3;
  return { revenue, cost, churn, cac, ltv };
}

export function buildProfitState(input: ProfitStateInput): ProfitState {
  const revenue = safeNum(input?.revenue ?? 0);
  const cost = safeNum(input?.cost ?? 0);
  const profit = revenue - cost;
  const margin = revenue > 0 ? (revenue - cost) / revenue : 0;
  const churn = safeNum(input?.churn ?? 0);
  const cac = safeNum(input?.cac ?? 0);
  const ltv = safeNum(input?.ltv ?? 0);
  return {
    revenue,
    cost,
    profit,
    margin,
    churn,
    cac,
    ltv,
    timestamp: Date.now(),
  };
}

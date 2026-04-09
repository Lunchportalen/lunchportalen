/**
 * Global intelligence context for growth automation (deterministic, explainable).
 * Pure mapping — no I/O.
 */

export type GlobalIntelligenceInput = {
  revenue?: unknown;
  conversion?: unknown;
  traffic?: unknown;
  churn?: unknown;
  experiments?: unknown;
  topPages?: unknown;
  worstPages?: unknown;
};

export type GlobalIntelligenceContext = {
  revenue: number;
  conversion: number;
  traffic: number;
  churn: number;
  experiments: number;
  topPages: string[];
  worstPages: string[];
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean);
}

export function buildGlobalContext(input: GlobalIntelligenceInput): GlobalIntelligenceContext {
  return {
    revenue: num(input.revenue),
    conversion: num(input.conversion),
    traffic: num(input.traffic),
    churn: num(input.churn),
    experiments: num(input.experiments),
    topPages: strList(input.topPages),
    worstPages: strList(input.worstPages),
  };
}

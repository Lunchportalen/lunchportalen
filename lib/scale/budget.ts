/**
 * Dynamic budget split across markets — bounded, deterministic, fully reversible via snapshot reset.
 * Total share always sums to 1 (no overspend of the normalized pool).
 */
import "server-only";

import type { Market } from "@/lib/scale/markets";

export const BUDGET_MIN_SHARE = 0.1;
export const BUDGET_MAX_SHARE = 0.4;

/** Previous run shares (same keys as market ids). `null` until first run after reset. */
let previousBudgetSnapshot: Record<string, number> | null = null;

export type BudgetAllocationResult = {
  ok: true;
  runId: string;
  /** Share of total budget pool (0–1 each); sum = 1 (within floating epsilon). */
  budgetPerMarket: Record<string, number>;
  /** Delta vs previous run (0 if no previous). */
  changeVsPrevious: Record<string, number>;
  /** Auditable steps — no hidden scoring. */
  explain: string[];
};

export type BudgetAllocationError = { ok: false; error: string };

function performanceScore(p: Market["performance"]): number {
  const r = Math.max(0, Math.log1p(Math.max(0, p.revenue)));
  const c = Math.max(0, p.conversion);
  const g = Math.max(0, p.growth);
  /** Explicit weights: revenue driver + conversion + growth (all observable inputs). */
  return r + 10 * c + 5 * g + 1e-9;
}

/** Eksponert for reallokering — samme formel som i {@link allocateBudget}. */
export function computeMarketBudgetScore(p: Market["performance"]): number {
  return performanceScore(p);
}

/**
 * Skriver neste budsjett-snapshot (normaliserer til sum 1). Kun for kontrollerte kall (f.eks. reallokering).
 */
export function commitBudgetSnapshot(next: Record<string, number>): { ok: true } | { ok: false; error: string } {
  const keys = Object.keys(next).filter((k) => k.trim());
  if (!keys.length) return { ok: false, error: "empty_snapshot" };
  let sum = 0;
  for (const k of keys) {
    const v = next[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return { ok: false, error: "invalid_share" };
    sum += v;
  }
  if (sum < 1e-12) return { ok: false, error: "zero_sum" };
  const norm: Record<string, number> = {};
  for (const k of keys) norm[k] = next[k]! / sum;
  previousBudgetSnapshot = norm;
  return { ok: true };
}

/**
 * Proportional split of (1 - n×floor) by scores, then clip to [floor, ceiling] and redistribute excess iteratively.
 */
function allocateBoundedShares(scores: number[], floor: number, ceiling: number): number[] {
  const n = scores.length;
  if (n === 0) return [];
  if (n * floor - 1 > 1e-9) throw new Error("BUDGET_INFEASIBLE_FLOOR");
  if (n * ceiling - 1 < -1e-9) throw new Error("BUDGET_INFEASIBLE_CEILING");

  const sumS = scores.reduce((a, b) => a + b, 0);
  const p = scores.map((s) => (sumS < 1e-12 ? 1 / n : s / sumS));
  const rem = 1 - n * floor;
  const w = p.map((pi) => floor + rem * pi);

  for (let iter = 0; iter < 40; iter++) {
    let excess = 0;
    for (let i = 0; i < n; i++) {
      if (w[i]! > ceiling + 1e-12) {
        excess += w[i]! - ceiling;
        w[i] = ceiling;
      }
    }
    if (excess < 1e-14) break;

    const eligibleIdx: number[] = [];
    for (let i = 0; i < n; i++) {
      if (w[i]! < ceiling - 1e-12) eligibleIdx.push(i);
    }
    if (eligibleIdx.length === 0) break;

    const eligScores = eligibleIdx.map((i) => scores[i]!);
    const es = eligScores.reduce((a, b) => a + b, 0);
    eligibleIdx.forEach((i, k) => {
      const share = es < 1e-12 ? 1 / eligibleIdx.length : eligScores[k]! / es;
      w[i] = w[i]! + excess * share;
    });
  }

  const total = w.reduce((a, b) => a + b, 0);
  if (total < 1e-12) return w.map(() => 1 / n);
  return w.map((x) => x / total);
}

function makeRunId(): string {
  return `bud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Rebalancer: higher `performance` → higher share, subject to 10–40% per market, full pool = 100%.
 * Updates internal snapshot for next run’s `changeVsPrevious`.
 */
export function allocateBudget(markets: ReadonlyArray<Pick<Market, "id" | "performance">>): BudgetAllocationResult | BudgetAllocationError {
  if (!markets.length) {
    return { ok: false, error: "empty_markets" };
  }

  const floor = BUDGET_MIN_SHARE;
  const ceiling = BUDGET_MAX_SHARE;
  const n = markets.length;
  if (n * floor > 1 + 1e-9 || n * ceiling < 1 - 1e-9) {
    return { ok: false, error: "infeasible_min_max_for_n" };
  }

  const ids = markets.map((m) => String(m.id ?? "").trim().toLowerCase()).filter(Boolean);
  if (ids.length !== markets.length || new Set(ids).size !== ids.length) {
    return { ok: false, error: "invalid_or_duplicate_market_id" };
  }

  const scores = markets.map((m) => performanceScore(m.performance));
  let shares: number[];
  try {
    shares = allocateBoundedShares(scores, floor, ceiling);
  } catch {
    return { ok: false, error: "allocation_projection_failed" };
  }

  const budgetPerMarket: Record<string, number> = {};
  ids.forEach((id, i) => {
    budgetPerMarket[id] = shares[i]!;
  });

  const sumShares = ids.reduce((a, id) => a + budgetPerMarket[id]!, 0);
  if (sumShares > 1e-12) {
    for (const id of ids) budgetPerMarket[id]! /= sumShares;
  }

  const changeVsPrevious: Record<string, number> = {};
  for (const id of ids) {
    const cur = budgetPerMarket[id]!;
    const prev = previousBudgetSnapshot?.[id];
    changeVsPrevious[id] = prev == null || !Number.isFinite(prev) ? 0 : cur - prev;
  }

  const explain: string[] = [
    `Regler: min ${(floor * 100).toFixed(0)} %, maks ${(ceiling * 100).toFixed(0)} % per marked; total andel = 100 %.`,
    `Score per marked = log1p(revenue) + 10×conversion + 5×growth + ε (høyere score → større andel av rest-potten etter gulv).`,
    `Omfordeling ved tak: overskudd fordeles proporsjonalt på score blant markeder under tak.`,
    previousBudgetSnapshot == null ? "Ingen tidligere kjøring — endring vs forrige satt til 0." : "Endring vs forrige = denne andel minus forrige lagrede andel.",
  ];

  previousBudgetSnapshot = { ...budgetPerMarket };

  return {
    ok: true,
    runId: makeRunId(),
    budgetPerMarket,
    changeVsPrevious,
    explain,
  };
}

/** Reversibility: glem forrige fordeling slik at neste `changeVsPrevious` baseline er nullstilt. */
export function resetBudgetAllocationSnapshot(): void {
  previousBudgetSnapshot = null;
}

/** Read-only: gjeldende lagrede forrige andeler (etter siste vellykkede `allocateBudget`). */
export function getLastBudgetSnapshot(): Record<string, number> | null {
  return previousBudgetSnapshot == null ? null : { ...previousBudgetSnapshot };
}

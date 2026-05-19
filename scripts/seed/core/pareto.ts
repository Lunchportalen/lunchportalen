/**
 * Deterministic Pareto-skew company size distribution for B4.1+.
 */

export const F1_FIRST10_EMAILS_HASH = "6426909b2e5c0d63c44d31ffc6776ce1";

export type ParetoOptions = {
  companies: number;
  targetUsers: number;
  seed?: number;
  alpha?: number;
  minPerCompany?: number;
  maxPerCompany?: number;
  tolerance?: number;
  /** First company reserved for F1 hello users (global index 0-9). */
  reservedFirstCompanyUsers?: number;
};

export type ParetoStats = {
  count: number;
  sum: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  ratioMaxMin: number;
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = clamp(Math.floor(sorted.length * p), 0, sorted.length - 1);
  return sorted[idx] ?? 0;
}

export function paretoStats(sizes: number[]): ParetoStats {
  const sorted = [...sizes].sort((a, b) => a - b);
  const sum = sizes.reduce((a, b) => a + b, 0);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  return {
    count: sizes.length,
    sum,
    min,
    max,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    ratioMaxMin: min > 0 ? max / min : 0,
  };
}

/**
 * Returns per-company user counts (length = companies) summing to ~targetUsers.
 * Index 0 is fixed to reservedFirstCompanyUsers (default 10 for F1 overlap).
 */
export function getCompanySizes(opts: ParetoOptions): number[] {
  const {
    companies,
    targetUsers,
    seed = 42,
    alpha = 1.16,
    minPerCompany = 10,
    maxPerCompany = 500,
    tolerance = 200,
    reservedFirstCompanyUsers = 10,
  } = opts;

  if (companies < 1) {
    throw new Error("PARETO_INVALID companies must be >= 1");
  }
  if (reservedFirstCompanyUsers > targetUsers) {
    throw new Error("PARETO_INVALID reservedFirstCompanyUsers exceeds targetUsers");
  }

  const tailCompanies = companies - 1;
  const tailTarget = targetUsers - reservedFirstCompanyUsers;

  const sizes: number[] = [reservedFirstCompanyUsers];

  if (tailCompanies === 0) {
    if (Math.abs(sizes[0]! - targetUsers) > tolerance) {
      throw new Error(
        `PARETO_SUM_FAIL sum=${sizes[0]} target=${targetUsers} tolerance=${tolerance}`,
      );
    }
    return sizes;
  }

  const rng = mulberry32(seed);
  const xMin = minPerCompany;
  const raw: number[] = [];

  for (let i = 0; i < tailCompanies; i++) {
    const u = rng();
    const safeU = Math.min(0.999999, Math.max(0.000001, u));
    const sample = xMin * Math.pow(1 - safeU, -1 / alpha);
    raw.push(clamp(Math.round(sample), minPerCompany, maxPerCompany));
  }

  const rawSum = raw.reduce((a, b) => a + b, 0);
  if (rawSum === 0) {
    throw new Error("PARETO_SUM_FAIL rawSum=0");
  }

  const scale = tailTarget / rawSum;
  const scaled = raw.map((n) => clamp(Math.round(n * scale), minPerCompany, maxPerCompany));

  let sum = reservedFirstCompanyUsers + scaled.reduce((a, b) => a + b, 0);
  let diff = targetUsers - sum;

  let idx = 0;
  while (diff !== 0 && idx < tailCompanies * 20) {
    const i = idx % tailCompanies;
    const current = scaled[i]!;
    if (diff > 0 && current < maxPerCompany) {
      scaled[i] = current + 1;
      diff -= 1;
    } else if (diff < 0 && current > minPerCompany) {
      scaled[i] = current - 1;
      diff += 1;
    }
    idx += 1;
  }

  sum = reservedFirstCompanyUsers + scaled.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - targetUsers) > tolerance) {
    throw new Error(
      `PARETO_SUM_FAIL sum=${sum} target=${targetUsers} tolerance=${tolerance}`,
    );
  }

  sizes.push(...scaled);
  return sizes;
}

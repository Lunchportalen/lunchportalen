/**
 * Two-proportion z-test (pooled SE). Deterministic; no sampling.
 * H0: pA = pB; two-sided p-value vs normal.
 */

export type SignificanceResult = {
  pValue: number;
  /** Requested confidence level used for the threshold (e.g. 0.95 → α = 0.05). */
  confidence: number;
  significant: boolean;
  z: number;
};

function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax));
  return sign * y;
}

/** Standard normal CDF Φ(z). */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Compare two binomial proportions (conversions / views).
 * @param confidence — e.g. 0.95 (reject H0 if pValue < 0.05)
 */
export function calculateSignificance(
  conversionsA: number,
  viewsA: number,
  conversionsB: number,
  viewsB: number,
  confidence: number = 0.95,
): SignificanceResult {
  const n1 = Math.max(0, Math.floor(viewsA));
  const n2 = Math.max(0, Math.floor(viewsB));
  const x1 = Math.min(n1, Math.max(0, Math.floor(conversionsA)));
  const x2 = Math.min(n2, Math.max(0, Math.floor(conversionsB)));

  const alpha = Math.min(0.49, Math.max(0.0001, 1 - confidence));
  const conf = 1 - alpha;

  if (n1 < 1 || n2 < 1) {
    return { pValue: 1, confidence: conf, significant: false, z: 0 };
  }

  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pPool = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

  if (se === 0 || !Number.isFinite(se)) {
    const diff = Math.abs(p1 - p2);
    return {
      pValue: diff < 1e-12 ? 1 : 0,
      confidence: conf,
      significant: diff > 1e-12 && diff > 0,
      z: 0,
    };
  }

  const z = (p1 - p2) / se;
  const absZ = Math.abs(z);
  const pOneTail = 1 - normalCdf(absZ);
  const pValue = Math.min(1, 2 * pOneTail);

  return {
    pValue,
    confidence: conf,
    significant: pValue < alpha,
    z,
  };
}

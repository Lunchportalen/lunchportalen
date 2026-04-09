/**
 * Fordeler heltallsporsjoner proporsjonalt på menyer (største-rest-metode).
 */

export function allocatePortionsProportional(total: number, weights: Map<string, number>): Record<string, number> {
  const t = Math.max(0, Math.floor(total));
  if (t === 0) return {};

  const keys = [...weights.keys()].filter((k) => weights.get(k)! > 0);
  const sum = keys.reduce((s, k) => s + Math.max(0, weights.get(k) ?? 0), 0);

  if (sum <= 0 || keys.length === 0) {
    return {};
  }

  const raw = keys.map((k) => {
    const w = weights.get(k) ?? 0;
    const exact = (t * w) / sum;
    return { k, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
  });

  const assigned = raw.reduce((s, x) => s + x.floor, 0);
  const remainder = t - assigned;

  raw.sort((a, b) => b.frac - a.frac);
  const out: Record<string, number> = {};
  for (let i = 0; i < raw.length; i++) {
    const x = raw[i]!;
    out[x.k] = x.floor + (i < remainder ? 1 : 0);
  }

  return out;
}

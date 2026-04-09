import { isCmsSurface, type CmsSurface } from "@/lib/cms/surfaces";

const PREFIX = "surface";

/** Stable key namespace so global pattern weights can be filtered per surface. */
export function surfaceScopedPatternKey(surface: CmsSurface, patternKey: string): string {
  const p = String(patternKey ?? "").trim();
  if (!p) return `${PREFIX}:${surface}:unknown`;
  if (p.startsWith(`${PREFIX}:`)) return p;
  return `${PREFIX}:${surface}:${p}`;
}

/** Inverse of surfaceScopedPatternKey for lookup against structural hits (unprefixed logical keys). */
export function stripSurfacePrefixFromPatternKey(key: string): string {
  const parts = String(key ?? "").split(":");
  if (parts.length >= 4 && parts[0] === PREFIX && isCmsSurface(parts[1]!)) {
    return parts.slice(2).join(":");
  }
  return key;
}

export function parseSurfaceFromPatternKey(key: string): CmsSurface | null {
  const parts = String(key ?? "").split(":");
  if (parts.length < 3 || parts[0] !== PREFIX) return null;
  const s = parts[1];
  return isCmsSurface(s) ? s : null;
}

/** Subset of weights whose keys belong to a surface namespace. */
export function filterPatternWeightsBySurface(
  weights: Record<string, number>,
  surface: CmsSurface,
): Record<string, number> {
  const prefix = `${PREFIX}:${surface}:`;
  const out: Record<string, number> = {};
  for (const [k, w] of Object.entries(weights)) {
    if (k.startsWith(prefix)) out[k] = w;
  }
  return out;
}

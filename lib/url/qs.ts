// lib/url/qs.ts
export type Defaults = Record<string, string | number | boolean | null | undefined>;

function isEmpty(v: any) {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

function toStr(v: any) {
  if (typeof v === "boolean") return v ? "1" : "";
  return String(v);
}

/**
 * Bygger querystring som:
 * - fjerner tomme verdier
 * - fjerner default-verdier
 * - sorterer keys stabilt
 * Returnerer "" eller "?a=1&b=2"
 */
export function buildCleanQuery(
  params: Record<string, any>,
  defaults: Defaults = {}
): string {
  const sp = new URLSearchParams();

  const keys = Object.keys(params).sort();
  for (const k of keys) {
    const v = params[k];
    if (isEmpty(v)) continue;

    const vNorm = toStr(v);
    const def = defaults[k];
    const defNorm = def === undefined || def === null ? "" : toStr(def);

    // dropp hvis lik default eller bool false (=> "")
    if (vNorm === defNorm) continue;
    if (vNorm === "") continue;

    sp.set(k, vNorm);
  }

  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

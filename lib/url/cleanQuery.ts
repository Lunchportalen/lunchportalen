// lib/url/cleanQuery.ts
export type Defaults = Record<string, string | number | boolean | null | undefined>;

function isEmpty(v: any) {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

export function buildCleanQuery(
  params: Record<string, any>,
  defaults: Defaults = {}
): string {
  const sp = new URLSearchParams();

  const keys = Object.keys(params).sort();
  for (const k of keys) {
    const v = params[k];

    if (isEmpty(v)) continue;

    const def = defaults[k];

    // normalize booleans
    const vNorm =
      typeof v === "boolean" ? (v ? "1" : "") : String(v);

    const defNorm =
      typeof def === "boolean" ? (def ? "1" : "") : def == null ? "" : String(def);

    // drop if equal to default OR boolean false
    if (vNorm === defNorm) continue;
    if (vNorm === "") continue;

    sp.set(k, vNorm);
  }

  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

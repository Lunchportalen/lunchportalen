/** Tillatte variant-ID-er: frø a/b og genererte g1, g2, … */
const DEMO_CTA_VARIANT_ID_RE = /^(?:[ab]|g[1-9]\d{0,5})$/;

export function isValidDemoCtaVariantId(id: string): boolean {
  return typeof id === "string" && id.length <= 8 && DEMO_CTA_VARIANT_ID_RE.test(id);
}

export function parseDemoCtaVariantIdFromQuery(raw: string | null): string | undefined {
  if (raw == null) return undefined;
  const s = raw.trim().slice(0, 8);
  if (s === "") return undefined;
  return isValidDemoCtaVariantId(s) ? s : undefined;
}

export function nextGeneratedVariantId(existingKeys: string[]): string {
  let max = 0;
  for (const k of existingKeys) {
    const m = /^g(\d+)$/.exec(k);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `g${max + 1}`;
}

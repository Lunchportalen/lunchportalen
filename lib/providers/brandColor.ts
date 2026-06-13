// lib/providers/brandColor.ts
// Kontrollert leverandørfarge: validering + fail-closed fallback til LP-gull.
// Fargen brukes KUN som aksent i små detaljer — aldri på flater, typografi
// eller hoved-CTA-er. Lunchportalen eier layout og uttrykk.

export const DEFAULT_BRAND_ACCENT = "#F5C518";

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

/** Normaliser til "#RRGGBB" (uppercase), ellers null. */
export function normalizeBrandHex(value: unknown): string | null {
  const m = HEX_RE.exec(String(value ?? "").trim());
  if (!m) return null;
  return `#${m[1].toUpperCase()}`;
}

/** WCAG relativ luminans (0 = svart, 1 = hvit). */
function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel((n >> 16) & 0xff);
  const g = channel((n >> 8) & 0xff);
  const b = channel(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Aksent vises på lys krem-flate; nær-hvite farger blir uleselige/usynlige
 * og avvises. (Full WCAG-sjekk mot lys/mørk er en senere forbedring.)
 */
export function brandHexHasReadableContrast(hex: string): boolean {
  return relativeLuminance(hex) <= 0.85;
}

/** Render-trygg aksent: validert leverandørfarge, ellers LP-gull (fail-closed). */
export function safeBrandAccent(value: unknown): string {
  const hex = normalizeBrandHex(value);
  if (!hex) return DEFAULT_BRAND_ACCENT;
  return brandHexHasReadableContrast(hex) ? hex : DEFAULT_BRAND_ACCENT;
}

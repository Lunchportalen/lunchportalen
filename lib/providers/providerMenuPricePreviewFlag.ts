// lib/providers/providerMenuPricePreviewFlag.ts
// R4E-1: server-side gate for optional provider menu price preview diagnostics.

import "server-only";

/**
 * True only when LP_PROVIDER_PRICE_PREVIEW_DISPLAY is explicitly "true".
 * Default false — no cookie, locale, or provider_settings lookup.
 */
export function isProviderMenuPricePreviewDisplayEnabled(): boolean {
  return String(process.env.LP_PROVIDER_PRICE_PREVIEW_DISPLAY ?? "").trim() === "true";
}

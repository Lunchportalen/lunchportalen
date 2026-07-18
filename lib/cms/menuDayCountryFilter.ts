/**
 * PHASE 17MENU — Sanity GROQ helpers for country-scoped menu reads.
 * Never silently fall back to Norway content for another country.
 */

export function menuDayCountryFilterClause(countryCode: string): string {
  const cc = String(countryCode ?? "").trim().toUpperCase();
  if (!cc) {
    throw new Error("COUNTRY_CODE_REQUIRED");
  }
  // Legacy NO docs may omit countryCode; treat missing as NO only.
  if (cc === "NO") {
    return `&& (!defined(countryCode) || countryCode == "NO")`;
  }
  return `&& countryCode == "${cc}"`;
}

export function assertNoNorwayFallback(args: {
  requestedCountry: string;
  documentCountry: string | null | undefined;
}): void {
  const requested = String(args.requestedCountry ?? "").trim().toUpperCase();
  const doc = String(args.documentCountry ?? "").trim().toUpperCase() || "NO";
  if (requested !== "NO" && doc === "NO") {
    throw new Error(`CROSS_COUNTRY_MENU_LEAK:requested=${requested}:doc=${doc}`);
  }
  if (requested && doc && requested !== doc) {
    throw new Error(`CROSS_COUNTRY_MENU_LEAK:requested=${requested}:doc=${doc}`);
  }
}

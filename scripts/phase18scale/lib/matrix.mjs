/**
 * Deterministic Phase 18 synthetic matrix constants and skew helpers.
 */
export const COUNTRIES = [
  "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
  "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
];

export const LOCALES = [
  "nb-NO", "sv-SE", "da-DK", "fi-FI", "en-GB", "de-DE", "fr-FR", "es-ES", "it-IT", "nl-NL",
  "nl-BE", "fr-BE", "de-CH", "fr-CH", "de-AT", "en-IE", "pl-PL", "ro-RO", "cs-CZ", "pt-PT",
  "el-GR", "en-US", "en-CA", "fr-CA",
];

export const CURRENCIES = [
  "NOK", "SEK", "DKK", "EUR", "GBP", "CHF", "PLN", "RON", "CZK", "USD", "CAD",
];

export const PACKAGES = ["BASIS", "LUXUS", "ENTERPRISE"];

export const PROVIDER_COUNT = 1000;
export const COMPANY_COUNT = 2000;
export const EMPLOYEE_COUNT = 100_000;
export const ACTIVE_ORDER_TARGET = 100_000;

/** Zipf-ish weights: hottest provider ~5%+, top 10 ~30%+. */
export function providerWeight(index0) {
  const rank = index0 + 1;
  return 1 / Math.pow(rank, 0.85);
}

export function buildProviderWeights(n = PROVIDER_COUNT) {
  const raw = Array.from({ length: n }, (_, i) => providerWeight(i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

export function pickWeightedIndex(weights, u01) {
  let acc = 0;
  const t = Number(u01) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i += 1) {
    acc += weights[i];
    if (t <= acc) return i;
  }
  return weights.length - 1;
}

export function countryForProviderIndex(i) {
  return COUNTRIES[i % COUNTRIES.length];
}

export function packageForCompanyIndex(i) {
  return PACKAGES[i % PACKAGES.length];
}

export function localeForEmployeeIndex(i) {
  return LOCALES[i % LOCALES.length];
}

/** DB profiles.preferred_locale check allows language tags only (nb, en, …). */
export function preferredLocaleDbForEmployeeIndex(i) {
  const full = localeForEmployeeIndex(i);
  const lang = String(full).split("-")[0].toLowerCase();
  const allowed = new Set([
    "nb", "en", "sv", "da", "fi", "de", "fr", "es", "it", "nl", "pl", "ro", "cs", "pt", "el",
  ]);
  return allowed.has(lang) ? lang : "en";
}

export function currencyForCountry(cc) {
  const map = {
    NO: "NOK", SE: "SEK", DK: "DKK", FI: "EUR", GB: "GBP", DE: "EUR", FR: "EUR",
    ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR", CH: "CHF", AT: "EUR", IE: "EUR",
    PL: "PLN", RO: "RON", CZ: "CZK", PT: "EUR", GR: "EUR", US: "USD", CA: "CAD",
  };
  return map[cc] || "EUR";
}

export function timezoneForCountry(cc) {
  const map = {
    NO: "Europe/Oslo", SE: "Europe/Stockholm", DK: "Europe/Copenhagen", FI: "Europe/Helsinki",
    GB: "Europe/London", DE: "Europe/Berlin", FR: "Europe/Paris", ES: "Europe/Madrid",
    IT: "Europe/Rome", NL: "Europe/Amsterdam", BE: "Europe/Brussels", CH: "Europe/Zurich",
    AT: "Europe/Vienna", IE: "Europe/Dublin", PL: "Europe/Warsaw", RO: "Europe/Bucharest",
    CZ: "Europe/Prague", PT: "Europe/Lisbon", GR: "Europe/Athens", US: "America/New_York",
    CA: "America/Toronto",
  };
  return map[cc] || "Europe/Oslo";
}

export function synthEmail(kind, index) {
  const n = String(index).padStart(6, "0");
  return `p18scale-${kind}-${n}@load.lunchportalen.test`;
}

export function synthSlug(kind, index) {
  return `p18scale-${kind}-${String(index).padStart(4, "0")}`;
}

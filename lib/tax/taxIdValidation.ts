/**
 * FASE 10 — tax/VAT-ID-validering per land (edge-safe, ingen server-imports).
 *
 * Strategi kommer ALLTID fra markedet (country), aldri fra locale eller språk.
 * Ærlighetsregel (LÅST): dette er FORMAT-validering. Ingen strategi hevder
 * live-oppslag mot VIES/HMRC/IRS — det ville vært en falsk integrasjonspåstand.
 */

import { SUPPORTED_COUNTRY_CODES, type CountryCode } from "@/lib/markets/supportedMarkets";

export type TaxIdValidationStrategy =
  | "no_orgnr_mva"
  | "eu_vies_format"
  | "uk_vat_format"
  | "ch_uid_format"
  | "us_ein_format"
  | "ca_bn_format";

export type TaxIdValidationResult = {
  valid: boolean;
  strategy: TaxIdValidationStrategy;
  /** Ærlig omfang: kun formatkontroll, aldri registeroppslag. */
  scope: "format_only";
  normalized: string | null;
  reason?: string;
};

/** EU-VAT-prefiks per medlemsland i markedsmodellen. */
const EU_VAT_PATTERNS: Partial<Record<CountryCode, RegExp>> = {
  SE: /^SE\d{12}$/,
  DK: /^DK\d{8}$/,
  FI: /^FI\d{8}$/,
  DE: /^DE\d{9}$/,
  FR: /^FR[A-Za-z0-9]{2}\d{9}$/,
  ES: /^ES[A-Za-z0-9]\d{7}[A-Za-z0-9]$/,
  IT: /^IT\d{11}$/,
  NL: /^NL\d{9}B\d{2}$/,
  BE: /^BE[01]\d{9}$/,
  AT: /^ATU\d{8}$/,
  IE: /^IE\d{7}[A-Wa-w][A-Ia-i]?$/,
  PL: /^PL\d{10}$/,
  RO: /^RO\d{2,10}$/,
  CZ: /^CZ\d{8,10}$/,
  PT: /^PT\d{9}$/,
  GR: /^(GR|EL)\d{9}$/,
};

export const TAX_ID_STRATEGY_BY_COUNTRY: Record<CountryCode, TaxIdValidationStrategy> = {
  NO: "no_orgnr_mva",
  SE: "eu_vies_format",
  DK: "eu_vies_format",
  FI: "eu_vies_format",
  GB: "uk_vat_format",
  DE: "eu_vies_format",
  FR: "eu_vies_format",
  ES: "eu_vies_format",
  IT: "eu_vies_format",
  NL: "eu_vies_format",
  BE: "eu_vies_format",
  CH: "ch_uid_format",
  AT: "eu_vies_format",
  IE: "eu_vies_format",
  PL: "eu_vies_format",
  RO: "eu_vies_format",
  CZ: "eu_vies_format",
  PT: "eu_vies_format",
  GR: "eu_vies_format",
  US: "us_ein_format",
  CA: "ca_bn_format",
};

function norm(value: string): string {
  return value.replace(/[\s.\-]/g, "").toUpperCase();
}

/**
 * Validerer et skatte-/MVA-nummer for et land. Fail-closed: ukjent land eller
 * tomt nummer er alltid ugyldig.
 */
export function validateTaxId(countryCode: string, rawTaxId: string): TaxIdValidationResult {
  const country = String(countryCode ?? "").trim().toUpperCase() as CountryCode;
  const strategy = TAX_ID_STRATEGY_BY_COUNTRY[country];
  if (!strategy || !(SUPPORTED_COUNTRY_CODES as readonly string[]).includes(country)) {
    return { valid: false, strategy: "eu_vies_format", scope: "format_only", normalized: null, reason: "UNSUPPORTED_COUNTRY" };
  }

  const value = norm(String(rawTaxId ?? ""));
  if (!value) {
    return { valid: false, strategy, scope: "format_only", normalized: null, reason: "EMPTY" };
  }

  let valid = false;
  switch (strategy) {
    case "no_orgnr_mva":
      // 9-sifret orgnr, valgfritt MVA-suffiks, valgfritt NO-prefiks.
      valid = /^(NO)?\d{9}(MVA)?$/.test(value);
      break;
    case "eu_vies_format": {
      const pattern = EU_VAT_PATTERNS[country];
      valid = pattern ? pattern.test(value) : false;
      break;
    }
    case "uk_vat_format":
      valid = /^(GB)?(\d{9}|\d{12})$/.test(value);
      break;
    case "ch_uid_format":
      // CHE-123.456.789 (normalisert: CHE123456789), valgfritt MWST/TVA/IVA-suffiks.
      valid = /^CHE\d{9}(MWST|TVA|IVA)?$/.test(value);
      break;
    case "us_ein_format":
      valid = /^\d{9}$/.test(value); // EIN: 12-3456789
      break;
    case "ca_bn_format":
      // Business Number: 9 siffer, valgfritt RT0001-programsuffiks (GST/HST).
      valid = /^\d{9}(RT\d{4})?$/.test(value);
      break;
  }

  return { valid, strategy, scope: "format_only", normalized: valid ? value : null, reason: valid ? undefined : "FORMAT_INVALID" };
}

/**
 * INERT MARKET COMMERCIAL CONFIG — ADR-017 R2
 *
 * NOT FOR RUNTIME. Do not import from app/, app/api/, billing, orders, Tripletex,
 * provider production, or menu publish paths until an explicit cutover ADR.
 *
 * UI locale (`lp_locale`, `profiles.preferred_locale`) is unrelated to this config.
 */

export type MarketCode = "NO" | "SE" | "DK" | "FI" | "DE" | "FR" | "ES" | "UK";

export type CurrencyCode = "NOK" | "SEK" | "DKK" | "EUR" | "GBP";

export type TaxBasis = "ex_tax" | "inc_tax" | "unknown";

/** Whether tax/commercial rules for a market have legal/accounting sign-off. */
export type TaxValidationStatus = "seed_only" | "requires_manual_validation" | "validated";

export type PriceDisplayMode = "ex_tax_primary" | "inc_tax_primary" | "dual_line";

export type TaxDisplayMode = "separate_line" | "inline_label" | "hidden";

export type MarketCommercialConfig = {
  marketCode: MarketCode;
  countryCode: string;
  defaultCurrency: CurrencyCode;
  defaultTimezone: string;
  /** UI locale hint only — does NOT drive tax, currency, commission, or menu culture. */
  defaultUiLocale: string;
  taxLabel: string;
  priceDisplayMode: PriceDisplayMode;
  taxDisplayMode: TaxDisplayMode;
  eInvoicingProfile: string;
  invoiceIntegration: string;
  enabled: boolean;
  productionReady: boolean;
  requiresManualValidation: boolean;
  taxValidationStatus: TaxValidationStatus;
  notes: string;
};

const NON_NO_BASE: Omit<
  MarketCommercialConfig,
  "marketCode" | "countryCode" | "defaultCurrency" | "defaultTimezone" | "defaultUiLocale" | "taxLabel" | "notes"
> = {
  priceDisplayMode: "ex_tax_primary",
  taxDisplayMode: "separate_line",
  eInvoicingProfile: "pending_manual_validation",
  invoiceIntegration: "pending_manual_validation",
  enabled: false,
  productionReady: false,
  requiresManualValidation: true,
  taxValidationStatus: "requires_manual_validation",
};

/**
 * Inert catalog — ADR-017 R2. Only NO is production-ready; others are placeholders.
 */
export const MARKET_COMMERCIAL_CONFIGS: Readonly<Record<MarketCode, MarketCommercialConfig>> = {
  NO: {
    marketCode: "NO",
    countryCode: "NO",
    defaultCurrency: "NOK",
    defaultTimezone: "Europe/Oslo",
    defaultUiLocale: "nb",
    taxLabel: "MVA",
    priceDisplayMode: "dual_line",
    taxDisplayMode: "inline_label",
    eInvoicingProfile: "norway_ehf_tripletex",
    invoiceIntegration: "tripletex_no",
    enabled: true,
    productionReady: true,
    requiresManualValidation: true,
    taxValidationStatus: "seed_only",
    notes:
      "NO seed only; not global billing truth. Matmoms 15% exists in tierPricing.ts as legacy fallback — requires accounting validation before multi-market cutover.",
  },
  SE: {
    ...NON_NO_BASE,
    marketCode: "SE",
    countryCode: "SE",
    defaultCurrency: "SEK",
    defaultTimezone: "Europe/Stockholm",
    defaultUiLocale: "sv",
    taxLabel: "Moms",
    notes: "Placeholder — not enabled. Tax rules require manual validation per ADR-017.",
  },
  DK: {
    ...NON_NO_BASE,
    marketCode: "DK",
    countryCode: "DK",
    defaultCurrency: "DKK",
    defaultTimezone: "Europe/Copenhagen",
    defaultUiLocale: "da",
    taxLabel: "Moms",
    notes: "Placeholder — not enabled. Tax rules require manual validation per ADR-017.",
  },
  FI: {
    ...NON_NO_BASE,
    marketCode: "FI",
    countryCode: "FI",
    defaultCurrency: "EUR",
    defaultTimezone: "Europe/Helsinki",
    defaultUiLocale: "fi",
    taxLabel: "ALV",
    notes: "Placeholder — not enabled. Tax rules require manual validation per ADR-017.",
  },
  DE: {
    ...NON_NO_BASE,
    marketCode: "DE",
    countryCode: "DE",
    defaultCurrency: "EUR",
    defaultTimezone: "Europe/Berlin",
    defaultUiLocale: "de",
    taxLabel: "USt",
    notes: "Placeholder — not enabled. No hardcoded VAT rates. Manual validation required.",
  },
  FR: {
    ...NON_NO_BASE,
    marketCode: "FR",
    countryCode: "FR",
    defaultCurrency: "EUR",
    defaultTimezone: "Europe/Paris",
    defaultUiLocale: "fr",
    taxLabel: "TVA",
    notes: "Placeholder — not enabled. No hardcoded VAT rates. Manual validation required.",
  },
  ES: {
    ...NON_NO_BASE,
    marketCode: "ES",
    countryCode: "ES",
    defaultCurrency: "EUR",
    defaultTimezone: "Europe/Madrid",
    defaultUiLocale: "es",
    taxLabel: "IVA",
    notes: "Placeholder — not enabled. No hardcoded VAT rates. Manual validation required.",
  },
  UK: {
    ...NON_NO_BASE,
    marketCode: "UK",
    countryCode: "GB",
    defaultCurrency: "GBP",
    defaultTimezone: "Europe/London",
    defaultUiLocale: "en",
    taxLabel: "VAT",
    notes: "Placeholder — not enabled. No hardcoded VAT rates. Manual validation required.",
  },
};

export const MARKET_COMMERCIAL_CONFIG_LIST: readonly MarketCommercialConfig[] = Object.values(
  MARKET_COMMERCIAL_CONFIGS,
);

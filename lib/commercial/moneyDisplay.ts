/**
 * INERT MONEY/TAX DISPLAY — ADR-017 R3A
 *
 * NOT FOR RUNTIME until an explicit cutover ADR.
 * Pure Intl-based formatting — no tax rates, commission, or market resolver.
 */

export type CurrencyCode = "NOK" | "SEK" | "DKK" | "EUR" | "GBP";

export type TaxBasis = "ex_tax" | "inc_tax" | "unknown";

export const DEFAULT_NO_LOCALE = "nb-NO";

export type MoneyDisplayInput = {
  /** Amount in minor units (e.g. øre for NOK). */
  amountMinor: number;
  currency: CurrencyCode;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export type MoneyDisplayResult = {
  formatted: string;
  currency: CurrencyCode;
  locale: string;
  amountMajor: number;
};

export type MoneyDisplayWithTaxBasisInput = MoneyDisplayInput & {
  taxBasis: TaxBasis;
  /** Optional tax acronym, e.g. "mva" → "eks. mva" in nb-NO. */
  taxLabel?: string;
  /** When false, omit tax basis suffix even if taxBasis is set. */
  showTaxBasis?: boolean;
};

function resolveLocale(locale?: string): string {
  const trimmed = String(locale ?? "").trim();
  return trimmed || DEFAULT_NO_LOCALE;
}

function isNorwegianLocale(locale: string): boolean {
  const base = locale.toLowerCase().split("-")[0];
  return base === "nb" || base === "no";
}

function minorToMajor(amountMinor: number): number {
  return amountMinor / 100;
}

function buildCurrencyFormatter(input: MoneyDisplayInput): Intl.NumberFormat {
  const locale = resolveLocale(input.locale);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: input.currency,
    minimumFractionDigits: input.minimumFractionDigits ?? 2,
    maximumFractionDigits: input.maximumFractionDigits ?? 2,
  });
}

export function formatMoneyDisplay(input: MoneyDisplayInput): MoneyDisplayResult {
  const locale = resolveLocale(input.locale);
  const amountMajor = minorToMajor(input.amountMinor);
  const formatted = buildCurrencyFormatter(input).format(amountMajor);

  return {
    formatted,
    currency: input.currency,
    locale,
    amountMajor,
  };
}

/**
 * Locale-aware tax basis suffix. Returns empty for `unknown` (no tax claim).
 */
export function formatTaxBasisLabel(taxBasis: TaxBasis, locale?: string): string {
  if (taxBasis === "unknown") return "";

  const loc = resolveLocale(locale);
  const norwegian = isNorwegianLocale(loc);

  if (taxBasis === "ex_tax") {
    return norwegian ? "eks. mva" : "ex VAT";
  }
  if (taxBasis === "inc_tax") {
    return norwegian ? "inkl. mva" : "inc VAT";
  }

  return "";
}

function formatTaxBasisFragment(taxBasis: TaxBasis, locale: string, taxLabel?: string): string {
  if (taxBasis === "unknown") return "";

  const label = String(taxLabel ?? "").trim();
  if (label) {
    const norwegian = isNorwegianLocale(locale);
    if (taxBasis === "ex_tax") return norwegian ? `eks. ${label}` : `ex ${label}`;
    if (taxBasis === "inc_tax") return norwegian ? `inkl. ${label}` : `inc ${label}`;
    return "";
  }

  return formatTaxBasisLabel(taxBasis, locale);
}

export function formatMoneyWithTaxBasis(input: MoneyDisplayWithTaxBasisInput): string {
  const money = formatMoneyDisplay(input);
  const showTaxBasis = input.showTaxBasis ?? true;

  if (!showTaxBasis || input.taxBasis === "unknown") {
    return money.formatted;
  }

  const fragment = formatTaxBasisFragment(input.taxBasis, money.locale, input.taxLabel);
  if (!fragment) return money.formatted;

  return `${money.formatted} ${fragment}`;
}

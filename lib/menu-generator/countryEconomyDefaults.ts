import type { EconomyConfig } from "@/lib/menu-generator/types";
import type { CurrencyCode, MarketCode } from "@/lib/menu-profile/types";
import { getMarketDefaults } from "@/lib/menu-profile/marketDefaults";

const VAT_BY_MARKET: Readonly<Record<MarketCode, number>> = {
  NO: 15 / 100,
  SE: 12 / 100,
  DK: 25 / 100,
  FI: 14 / 100,
  DE: 19 / 100,
  FR: 10 / 100,
  ES: 10 / 100,
  UK: 20 / 100,
  IT: 10 / 100,
  US: 0,
  CA: 0,
  NL: 9 / 100,
  BE: 12 / 100,
  AT: 10 / 100,
  CH: 8.1 / 100,
  IE: 13.5 / 100,
  LU: 8 / 100,
  AU: 10 / 100,
  SG: 9 / 100,
};

function costBasisForCurrency(currency: CurrencyCode): number {
  const noCurrency = getMarketDefaults("NO").defaultCurrency;
  if (currency === noCurrency) return 85;
  if (currency === "SEK") return 90;
  if (currency === "DKK") return 65;
  if (currency === "EUR") return 8.5;
  if (currency === "GBP") return 7.5;
  if (currency === "USD") return 9.5;
  if (currency === "CAD") return 12;
  if (currency === "CHF") return 10;
  if (currency === "AUD") return 13;
  if (currency === "SGD") return 12;
  return 85;
}

function packagePrices(exVat: number, vatRate: number) {
  return {
    basis: { exVat, incVat: Math.round(exVat * (1 + vatRate) * 100) / 100 },
    luxus: { exVat: exVat + 25, incVat: Math.round((exVat + 25) * (1 + vatRate) * 100) / 100 },
    enterprise: {
      exVat: exVat + 45,
      incVat: Math.round((exVat + 45) * (1 + vatRate) * 100) / 100,
    },
  };
}

export function resolveEconomyConfigForMarket(market: MarketCode): EconomyConfig {
  const defaults = getMarketDefaults(market);
  const currency = defaults.defaultCurrency;
  const vatRate = VAT_BY_MARKET[market] ?? 15 / 100;
  const providerCostBasis = costBasisForCurrency(currency);

  return {
    currency,
    vatRate,
    providerCostBasis,
    packagePriceRules: packagePrices(providerCostBasis + 40, vatRate),
    marginTarget: 0.22,
    internalCostFields: {
      sandwichCost: providerCostBasis * 0.35,
      saladCost: providerCostBasis * 0.38,
      hotMealCost: providerCostBasis * 0.55,
      premiumUpgradeCost: providerCostBasis * 0.18,
    },
  };
}

export function resolveEconomyConfigForCountry(countryCode: string): EconomyConfig {
  const normalized = String(countryCode ?? "").trim().toUpperCase();
  const marketMap: Record<string, MarketCode> = {
    NO: "NO",
    SE: "SE",
    DK: "DK",
    FI: "FI",
    DE: "DE",
    FR: "FR",
    ES: "ES",
    GB: "UK",
    UK: "UK",
    IT: "IT",
    US: "US",
    CA: "CA",
    NL: "NL",
    BE: "BE",
    AT: "AT",
    CH: "CH",
    IE: "IE",
    LU: "LU",
    AU: "AU",
    SG: "SG",
  };
  const market = marketMap[normalized] ?? "NO";
  return resolveEconomyConfigForMarket(market);
}

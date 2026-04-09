import type { NextRequest } from "next/server";

export type MarketContext = {
  country: string;
  language: string;
  currency: string;
};

/**
 * Header-based market hints (additive). Defaults: Norway / norsk / NOK.
 */
export function getMarketContext(req: NextRequest | Request): MarketContext {
  const h = (name: string) => String(req.headers.get(name) ?? "").trim();
  return {
    country: h("x-country") || "NO",
    language: h("x-lang") || "no",
    currency: h("x-currency") || "NOK",
  };
}

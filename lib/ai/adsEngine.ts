/**
 * Ad copy variants for Google / Meta — generation only; no spend, no campaign creation.
 */

import { suggestAudiencesForProduct } from "./audience";

export type AdsContext = {
  product: string;
  audience?: string;
  locale?: "nb" | "en";
  channels?: ("google" | "meta")[];
};

export type AdsEngineResult = {
  headlines: string[];
  descriptions: string[];
  audiences: string[];
};

function trimProduct(p: string): string {
  return p.trim().slice(0, 500);
}

/**
 * High-CTR oriented headlines/descriptions (Norwegian default); multiple variants.
 */
export function generateAds(context: AdsContext): AdsEngineResult {
  const product = trimProduct(context.product || "Lunchportalen");
  const audience = (context.audience || "").trim().slice(0, 300);
  const locale = context.locale === "en" ? "en" : "nb";

  const audiences = suggestAudiencesForProduct(product);
  if (audience) {
    audiences.unshift(`Egendefinert: ${audience}`);
  }

  const headlinesNb = [
    `${product.split(".")[0].slice(0, 40)} — mindre admin, bedre lunsj`,
    "Samlet bedriftslunsj på ett sted",
    "Erstatt kantinekaos med kontroll og forutsigbarhet",
    "Book demo: se lunsjflyten på 15 minutter",
    "Bærekraft og oversikt — uten ekstra Excel",
    audience ? `Skreddersydd for ${audience.slice(0, 35)}…` : "Bygget for norske bedrifter",
  ];

  const headlinesEn = [
    "One portal for company lunch — less admin",
    "Replace canteen chaos with a calm workflow",
    "Book a 15-minute demo",
    "Built for Norwegian workplaces",
    audience ? `Tailored for teams like yours` : "Predictable lunch operations",
  ];

  const descriptionsNb = [
    `Få oversikt over bestillinger, leveranser og kostnader. ${product.slice(0, 80)}.`,
    "Reduser friksjon for HR og ansatte. Tydelig CTA: be om demo i dag.",
    "Én sannhet for lunsj: roller, lokasjoner og avtaler samlet — uten manuelle rundmailer.",
    "Google/Meta: bruk én variant om gangen, mål CTR mot landing med samme budskap som annonsen.",
  ];

  const descriptionsEn = [
    "One source of truth for orders, slots, and spend. Request a demo.",
    "Less back-and-forth for HR and employees. Single primary CTA on the landing page.",
    "Run one headline variant per ad group; match landing H1 to the ad for Quality Score.",
  ];

  return {
    headlines: locale === "en" ? headlinesEn : headlinesNb,
    descriptions: locale === "en" ? descriptionsEn : descriptionsNb,
    audiences: audiences.slice(0, 8),
  };
}

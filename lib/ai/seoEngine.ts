/**
 * Deterministic SEO opportunity engine — suggests only; never publishes or changes CMS.
 */

import { expandKeywordSeeds, intentForPhrase, type SearchIntent } from "./keywords";

export type SitePage = {
  path: string;
  title?: string;
  keywordHints?: string[];
  impressions?: number;
  clicks?: number;
};

export type SiteData = {
  domain?: string;
  locale?: string;
  pages?: SitePage[];
  existingKeywords?: string[];
  competitors?: string[];
};

export type SeoOpportunity = {
  id: string;
  type: "keyword_gap" | "weak_page" | "intent_gap" | "internal_link" | "technical_hint";
  message: string;
  priority: "high" | "medium" | "low";
};

export type SeoKeyword = {
  phrase: string;
  intent: SearchIntent;
  reason: string;
};

export type SeoEngineResult = {
  opportunities: SeoOpportunity[];
  keywords: SeoKeyword[];
  contentIdeas: string[];
};

function slugifyToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9æøå-]/gi, "")
    .slice(0, 48);
}

/**
 * Analyzes site-shaped data for gaps (no external APIs, no crawl).
 */
export function runSeoEngine(siteData: SiteData): SeoEngineResult {
  const opportunities: SeoOpportunity[] = [];
  const keywords: SeoKeyword[] = [];
  const contentIdeas: string[] = [];
  const pages = Array.isArray(siteData.pages) ? siteData.pages : [];
  const existing = (siteData.existingKeywords ?? []).map((k) => k.toLowerCase().trim()).filter(Boolean);

  const missingSeeds = expandKeywordSeeds(existing);
  for (const phrase of missingSeeds.slice(0, 6)) {
    opportunities.push({
      id: `kw-gap-${slugifyToken(phrase)}`,
      type: "keyword_gap",
      message: `Mangler synlighet for «${phrase}» — vurder dedikert landingsside eller seksjon på forsiden.`,
      priority: phrase.includes("alternativ") || phrase.includes("bedrift") ? "high" : "medium",
    });
    keywords.push({
      phrase,
      intent: intentForPhrase(phrase),
      reason: "Samsvarer med kjerneprodukt og søketermer som ofte brukes i B2B-beslutning.",
    });
  }

  for (const p of pages) {
    const path = (p.path || "").trim() || "/";
    const title = (p.title || "").trim();
    if (!title || title.length < 12) {
      opportunities.push({
        id: `weak-title-${slugifyToken(path)}`,
        type: "weak_page",
        message: `Siden «${path}» har kort eller manglende tittel — styrk H1 og meta-tittel (55–60 tegn).`,
        priority: "high",
      });
    }
    const imp = typeof p.impressions === "number" ? p.impressions : null;
    const clk = typeof p.clicks === "number" ? p.clicks : null;
    if (imp != null && imp > 200 && clk != null && clk / imp < 0.02) {
      opportunities.push({
        id: `weak-ctr-${slugifyToken(path)}`,
        type: "weak_page",
        message: `Lav CTR på «${path}» — test ny meta-beskrivelse og tydelig intensjonsord i tittel.`,
        priority: "medium",
      });
    }
    if (title && !/lunsj|kantine|bedrift|kontor/i.test(title)) {
      opportunities.push({
        id: `intent-${slugifyToken(path)}`,
        type: "intent_gap",
        message: `«${path}» mangler tydelig kobling til arbeidsplass/lunsj-intent i tittel — vurder presisering.`,
        priority: "low",
      });
    }
  }

  if (pages.length >= 2) {
    const paths = pages.map((x) => x.path).filter(Boolean);
    const hasHub = paths.some((x) => x === "/" || x === "/lunsjordning" || x === "/hvordan");
    if (!hasHub) {
      opportunities.push({
        id: "internal-hub",
        type: "internal_link",
        message: "Ingen tydelig hub-side funnet — lenk undersider til forsiden og til 2–3 pilar-sider.",
        priority: "medium",
      });
    } else {
      opportunities.push({
        id: "internal-deep",
        type: "internal_link",
        message: "Sørg for kontekstuelle lenker fra blogg/ressurser til produktsider og demo-CTA.",
        priority: "low",
      });
    }
  }

  if (siteData.competitors?.length) {
    opportunities.push({
      id: "competitive-serp",
      type: "technical_hint",
      message: "Sammenlign titler og H2 med konkurrentliste — fyll gap med unike proof-punkter og tall.",
      priority: "low",
    });
  }

  contentIdeas.push("Kort guide: «Slik innfører du bedriftslunsj uten kantine på 30 dager» (H2 + FAQ-schema).");
  contentIdeas.push("Case: målbar tidsbesparelse for HR ved samlet lunsjbestilling.");
  contentIdeas.push("Sammenligningsside: kantine vs. portal — tabell + én tydelig CTA.");
  contentIdeas.push("Landing for «alternativ til kantine» med kalkulator og demo-CTA.");

  return { opportunities, keywords, contentIdeas };
}

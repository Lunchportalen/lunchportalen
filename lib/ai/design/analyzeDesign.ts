/**
 * STEP 1 — Analyzer: structure + DesignSettings → explainable issues (no patches).
 */

import type { ParsedDesignSettings } from "@/lib/cms/design/designContract";
import { resolvedCardForBlockType } from "@/lib/cms/design/designContract";

import type { DesignAnalyzeContext, DesignBlockSummary, DesignIssue, DesignIssueCode } from "./types";

function countType(blocks: DesignBlockSummary[], t: string): number {
  return blocks.filter((b) => b.type === t).length;
}

export type AnalyzeDesignInput = {
  blocks: DesignBlockSummary[];
  designSettings: ParsedDesignSettings;
  locale?: string;
};

export type AnalyzeDesignOutput = {
  issues: DesignIssue[];
  context: DesignAnalyzeContext;
};

export function analyzeDesign(input: AnalyzeDesignInput): AnalyzeDesignOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];
  const ds = input.designSettings;

  const blockCount = blocks.length;
  const blockTypes = [...new Set(blocks.map((b) => b.type))];
  const hasHero = blocks.some((b) => b.type === "hero");
  const hasCta = blocks.some((b) => b.type === "cta");
  const hasPricing = blocks.some((b) => b.type === "pricing");
  const richTextCount = countType(blocks, "richText");
  const cardsBlockCount = countType(blocks, "cards");

  const context: DesignAnalyzeContext = {
    blockCount,
    blockTypes,
    hasHero,
    hasCta,
    hasPricing,
    richTextCount,
    cardsBlockCount,
  };

  const issues: DesignIssue[] = [];
  const seen = new Set<DesignIssueCode>();

  function push(issue: DesignIssue) {
    if (seen.has(issue.code)) return;
    seen.add(issue.code);
    issues.push(issue);
  }

  const sp = ds.spacing.section;
  const surf = ds.surface.section;
  const typoH = ds.typography.heading;
  const layoutC = ds.layout.container;

  if (sp === "tight" && blockCount >= 3) {
    push({
      code: "SPACING_TIGHT",
      type: "spacing",
      severity: "medium",
      message: isEn ? "Sections are too dense for the number of blocks." : "Seksjonene er for tette i forhold til antall blokker.",
      current: "tight",
    });
  } else if (sp === "normal" && blockCount >= 8) {
    push({
      code: "SPACING_DENSE_PAGE",
      type: "spacing",
      severity: "medium",
      message: isEn ? "Long page may read better with wider vertical rhythm." : "Lang side kan lese bedre med luftigere vertikal rytme.",
      current: "normal",
    });
  }

  if (typoH === "default" && hasHero && blockCount >= 4) {
    push({
      code: "TYPO_HIERARCHY",
      type: "hierarchy",
      severity: "medium",
      message: isEn ? "Heading scale is modest while the page is hero-led." : "Overskriftskala er beskjeden på en hero-drevet side.",
      current: "default",
    });
  }

  if (surf === "default" && blockCount >= 6 && richTextCount >= 2) {
    push({
      code: "SURFACE_CONTRAST",
      type: "contrast",
      severity: "medium",
      message: isEn ? "Low visual separation between stacked text sections." : "Lav visuell separasjon mellom tekstseksjoner.",
      current: "default",
    });
  }

  if (layoutC === "normal" && cardsBlockCount >= 2 && blockCount >= 5) {
    push({
      code: "LAYOUT_WIDE_CARDS",
      type: "layout",
      severity: "low",
      message: isEn ? "Card-heavy layout may benefit from a slightly wider content rail." : "Kort-tung layout kan tåle litt bredere innholdsspor.",
      current: "normal",
    });
  }

  const ctaCard = resolvedCardForBlockType("cta", undefined, ds);
  if (hasCta && blockCount >= 5 && ctaCard.hover === "none") {
    push({
      code: "CARD_CTA_HOVER",
      type: "cta",
      severity: "low",
      message: isEn ? "CTA surfaces have no hover emphasis on a deep page." : "CTA-flater mangler hover-trykk på en lang side.",
      current: "none",
    });
  }

  const pricingCard = resolvedCardForBlockType("pricing", undefined, ds);
  if (hasPricing && blockCount >= 4 && pricingCard.hover === "none") {
    push({
      code: "CARD_PRICING_HOVER",
      type: "cta",
      severity: "low",
      message: isEn ? "Pricing tiles have no hover feedback." : "Pris-kort mangler hover-tilbakemelding.",
      current: "none",
    });
  }

  return { issues, context };
}

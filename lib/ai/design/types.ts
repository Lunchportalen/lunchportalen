/**
 * Shared types for the safe DesignSettings optimizer pipeline.
 * No block mutation — tokens live in global_content.settings.data.designSettings only.
 */

import type { DesignSettingsDocument } from "@/lib/cms/design/designContract";

export type DesignBlockSummary = { id: string; type: string };

export type DesignIssueSeverity = "low" | "medium" | "high";

export type DesignIssueCategory = "spacing" | "typography" | "surface" | "layout" | "card" | "hierarchy" | "contrast" | "cta";

/** Stable analyzer codes — map 1:1 to suggestions in suggestDesignImprovements. */
export type DesignIssueCode =
  | "SPACING_TIGHT"
  | "SPACING_DENSE_PAGE"
  | "TYPO_HIERARCHY"
  | "SURFACE_CONTRAST"
  | "LAYOUT_WIDE_CARDS"
  | "CARD_CTA_HOVER"
  | "CARD_PRICING_HOVER";

export type DesignIssue = {
  code: DesignIssueCode;
  type: DesignIssueCategory;
  severity: DesignIssueSeverity;
  message: string;
  /** Current token value when relevant, e.g. "tight" */
  current?: string;
};

export type SuggestionRisk = "low" | "medium" | "high";

export type DesignImprovementSuggestion = {
  /** Matches DesignIssue.code */
  id: DesignIssueCode;
  key: string;
  from: string;
  to: string;
  reason: string;
  risk: SuggestionRisk;
  patch: DesignSettingsDocument;
};

export type DesignAnalyzeContext = {
  blockCount: number;
  blockTypes: string[];
  hasHero: boolean;
  hasCta: boolean;
  hasPricing: boolean;
  richTextCount: number;
  cardsBlockCount: number;
};

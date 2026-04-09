/**
 * STEP 2 — Suggestion engine: issues → deterministic DesignSettings patches (no randomness).
 */

import type { DesignIssue, DesignImprovementSuggestion } from "./types";

export type SuggestDesignImprovementsInput = {
  issues: DesignIssue[];
  locale?: string;
};

export type SuggestDesignImprovementsOutput = {
  suggestions: DesignImprovementSuggestion[];
};

/** Pure mapping: one suggestion per issue code, fixed order by issue array order. */
export function suggestDesignImprovements(input: SuggestDesignImprovementsInput): SuggestDesignImprovementsOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const issues = Array.isArray(input.issues) ? input.issues : [];

  const byCode = new Map(issues.map((i) => [i.code, i] as const));

  const ordered: DesignImprovementSuggestion[] = [];

  const add = (s: DesignImprovementSuggestion) => {
    if (!byCode.has(s.id)) return;
    ordered.push(s);
  };

  add({
    id: "SPACING_TIGHT",
    key: "spacing.section",
    from: "tight",
    to: "normal",
    reason: isEn ? "Improve readability with standard vertical rhythm." : "Bedre lesbarhet med normal vertikal rytme.",
    risk: "low",
    patch: { spacing: { section: "normal" } },
  });

  add({
    id: "SPACING_DENSE_PAGE",
    key: "spacing.section",
    from: "normal",
    to: "wide",
    reason: isEn ? "Give long pages more breathing room." : "Gi lange sider mer luft.",
    risk: "low",
    patch: { spacing: { section: "wide" } },
  });

  add({
    id: "TYPO_HIERARCHY",
    key: "typography.heading",
    from: "default",
    to: "display",
    reason: isEn ? "Strengthen visual hierarchy on hero-led pages." : "Styrk visuelt hierarki på hero-sider.",
    risk: "medium",
    patch: { typography: { heading: "display" } },
  });

  add({
    id: "SURFACE_CONTRAST",
    key: "surface.section",
    from: "default",
    to: "contrast",
    reason: isEn ? "Improve section separation for dense text." : "Bedre seksjonsseparasjon ved tett tekst.",
    risk: "medium",
    patch: { surface: { section: "contrast" } },
  });

  add({
    id: "LAYOUT_WIDE_CARDS",
    key: "layout.container",
    from: "normal",
    to: "wide",
    reason: isEn ? "Widen content rail for card-heavy layouts." : "Bredere innholdsspor for kort-tunge layouter.",
    risk: "low",
    patch: { layout: { container: "wide" } },
  });

  add({
    id: "CARD_CTA_HOVER",
    key: "card.cta.hover",
    from: "none",
    to: "lift",
    reason: isEn ? "Subtle lift draws attention without changing copy." : "Diskret løft uten å endre innhold.",
    risk: "low",
    patch: { card: { cta: { hover: "lift" } } },
  });

  add({
    id: "CARD_PRICING_HOVER",
    key: "card.pricing.hover",
    from: "none",
    to: "lift",
    reason: isEn ? "Improve perceived interactivity on pricing tiles." : "Bedre opplevd interaktivitet på pris-kort.",
    risk: "low",
    patch: { card: { pricing: { hover: "lift" } } },
  });

  return { suggestions: ordered };
}

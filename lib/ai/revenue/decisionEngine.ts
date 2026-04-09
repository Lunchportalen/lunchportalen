/**
 * STEP 4 — Decision engine: deterministic mapping weakPoint → proposed actions.
 * Separates design (global DesignSettings) vs content (per-block copy).
 */

import type { RevenueWeakPoint } from "./analyzePerformance";

export type RevenueActionType = "design" | "content" | "experiment";

export type RevenueAction = {
  type: RevenueActionType;
  target: string;
  change: string;
  /** Cites metric keys / issue codes — not subjective aesthetics */
  reason: string;
  /** For experiments.ts */
  experimentKey?: string;
  blockId?: string;
};

const ISSUE_TO_ACTIONS: Record<string, (w: RevenueWeakPoint) => RevenueAction[]> = {
  low_scroll_depth: (w) => [
    {
      type: "design",
      target: "spacing.section",
      change: "wide",
      reason: `Data: ${w.evidence} → mer luft kan øke dybde (hypotese; måles etter endring).`,
    },
    {
      type: "design",
      target: "typography.heading",
      change: "display",
      reason: "Data: lav scroll-dybde — sterkere hierarki kan forbedre skanning (måles).",
    },
  ],
  low_page_ctr: () => [
    {
      type: "content",
      target: "hero",
      change: "stronger_primary_value_prop",
      reason: "Data: lav side-CTR — tydeligere budskap/knapp i hero (måles via cta_click).",
    },
  ],
  low_cta_ctr_vs_page: (w) => [
    {
      type: "design",
      target: "card.cta.hover",
      change: "lift",
      reason: `Data: ${w.evidence}`,
      blockId: w.blockId,
    },
    {
      type: "content",
      target: w.blockId ?? "cta",
      change: "stronger_cta_label",
      reason: `Data: underpresterende CTA-blokk ${w.blockId ?? ""} — kortere, mer konkret label (måles).`,
      blockId: w.blockId,
    },
  ],
  clicks_without_conversion: (w) => [
    {
      type: "content",
      target: w.blockId ?? "form",
      change: "reduce_friction_next_step",
      reason: `Data: ${w.evidence} — avstem landing/skjema-tekst med intensjon (måles).`,
      blockId: w.blockId,
    },
  ],
  dense_layout_may_limit_scroll: (w) => [
    {
      type: "design",
      target: "spacing.section",
      change: "normal",
      reason: `Data: ${w.evidence}`,
    },
  ],
};

export function decideRevenueActions(weakPoints: RevenueWeakPoint[]): RevenueAction[] {
  const out: RevenueAction[] = [];
  const seen = new Set<string>();
  for (const w of weakPoints) {
    const fn = ISSUE_TO_ACTIONS[w.issue];
    if (!fn) continue;
    for (const a of fn(w)) {
      const k = `${a.type}:${a.target}:${a.change}:${a.blockId ?? ""}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(a);
    }
  }
  return out;
}

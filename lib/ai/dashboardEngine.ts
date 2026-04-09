import type { PlatformAiBillingOverview } from "@/lib/ai/usageOverview";

/**
 * Deterministic recommendations from platform AI usage + billing snapshot.
 * Execution: superadmin POST /api/ai/recommendation/apply (see lib/ai/recommendationActions.ts).
 */

export type AiRecommendationKind =
  | "margin_risk"
  | "downgrade_model"
  | "block_tool"
  | "upsell_plan"
  | "billing_flag_followup"
  | "revenue_config";

export type AiDashboardRecommendation = {
  id: string;
  kind: AiRecommendationKind;
  severity: "info" | "warn" | "critical";
  /** 0–1 heuristic certainty for autonomous execution / ranking (deterministic from snapshot). */
  confidence: number;
  /** Optional factor → weight used to derive `confidence` (debug / UI). */
  confidence_factors?: Record<string, number>;
  /** How strongly empirical samples support auto (0–1); set when learning snapshot is merged. */
  learning_confidence?: number;
  /** Heuristic × outcome-adjusted score for auto policy (0–1). */
  outcome_adjusted_confidence?: number;
  title: string;
  detail: string;
  refs?: {
    company_id?: string;
    company_name?: string | null;
    tool?: string;
  };
};

function envNumber(key: string, fallback: number): number {
  const raw = String(process.env[key] ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function companyLabel(name: string | null | undefined, id: string): string {
  const n = typeof name === "string" && name.trim() ? name.trim() : null;
  return n ?? `${id.slice(0, 8)}…`;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function confidenceBlockTool(params: {
  share: number;
  runs: number;
  runsMin: number;
  severity: "warn" | "critical";
}): { confidence: number; confidence_factors: Record<string, number> } {
  const { share, runs, runsMin, severity } = params;
  const fShare = clamp01((share - 0.28) / 0.42);
  const fRuns = clamp01(Math.min(1, (runs - runsMin) / Math.max(1, 120 - runsMin)));
  const fSev = severity === "critical" ? 0.85 : 0.65;
  const confidence = clamp01(0.34 + 0.38 * fShare + 0.2 * fRuns + 0.08 * fSev);
  return {
    confidence,
    confidence_factors: { cost_share: fShare, runs: fRuns, severity_hint: fSev },
  };
}

function confidenceDowngradeModel(c: {
  cost_estimate_usd: number;
  list_mrr_usd: number | null;
  margin_vs_cost_usd: number | null;
}): { confidence: number; confidence_factors: Record<string, number> } {
  const mrr = c.list_mrr_usd != null && c.list_mrr_usd > 0 ? c.list_mrr_usd : 0;
  const costRatio = mrr > 0 ? c.cost_estimate_usd / mrr : 1.8;
  const fCost = clamp01(Math.min(1, (costRatio - 0.95) / 1.35));
  const negMargin = c.margin_vs_cost_usd != null ? -c.margin_vs_cost_usd : 0;
  const fMargin = clamp01(Math.min(1, negMargin / (mrr > 0 ? mrr * 0.55 : 2)));
  const confidence = clamp01(0.36 + 0.38 * fCost + 0.36 * fMargin);
  return {
    confidence,
    confidence_factors: { cost_vs_mrr: fCost, margin_pressure: fMargin },
  };
}

/**
 * Build prioritized recommendations from platform overview (usage, billing, margin, per-tool).
 */
export function buildAiDashboardRecommendations(overview: PlatformAiBillingOverview): AiDashboardRecommendation[] {
  const out: AiDashboardRecommendation[] = [];
  const { totals, by_tool, top_companies, alerts, flagged_companies } = overview;

  const toolCostShareWarn = envNumber("AI_DASHBOARD_TOOL_COST_SHARE_WARN", 0.35);
  const toolRunsMin = envNumber("AI_DASHBOARD_BLOCK_TOOL_MIN_RUNS", 15);
  const upsellBasicRuns = envNumber("AI_DASHBOARD_UPSELL_BASIC_MIN_RUNS", 80);
  const upsellBasicCostUsd = envNumber("AI_DASHBOARD_UPSELL_BASIC_MIN_COST_USD", 0.75);
  const thinMarginRatio = envNumber("AI_DASHBOARD_THIN_MARGIN_RATIO", 0.12);

  if (totals.revenue_partial) {
    out.push({
      id: "revenue-config-partial",
      kind: "revenue_config",
      severity: "warn",
      confidence: 0.42,
      title: "Fullfør MRR-grunnlag for beslutninger",
      detail:
        "Sett SAAS_LIST_MRR_BASIC_USD / PRO / ENTERPRISE slik at margin og oppsalg kan vurderes konsistent for alle selskaper med AI-bruk.",
    });
  }

  if (alerts.margin_below_threshold && totals.margin_usd != null) {
    const depth = alerts.min_margin_usd > 0 ? clamp01(-totals.margin_usd / alerts.min_margin_usd) : 0.72;
    out.push({
      id: "margin-below-threshold",
      kind: "margin_risk",
      severity: "critical",
      confidence: clamp01(0.55 + 0.28 * depth),
      confidence_factors: { below_threshold_depth: depth },
      title: "Margin under intern terskel",
      detail: `Aggregert margin er ${totals.margin_usd.toFixed(2)} USD (terskel ${alerts.min_margin_usd.toFixed(2)} USD via AI_DASHBOARD_MIN_MARGIN_USD). Vurder kostnadstiltak eller prismodell før månedsslutt.`,
    });
  } else if (
    totals.margin_usd != null &&
    totals.total_list_mrr_usd != null &&
    totals.total_list_mrr_usd > 0 &&
    totals.margin_usd < totals.total_list_mrr_usd * thinMarginRatio
  ) {
    const thin = clamp01(1 - totals.margin_usd / (totals.total_list_mrr_usd * thinMarginRatio));
    out.push({
      id: "margin-thin-relative",
      kind: "margin_risk",
      severity: "warn",
      confidence: clamp01(0.45 + 0.22 * thin),
      confidence_factors: { thin_relative: thin },
      title: "Marginrisiko: lav andel av list MRR",
      detail: `Margin utgjør under ${Math.round(thinMarginRatio * 100)} % av summert list MRR. Overvåk kostnadsvekst og tyngste verktøy/kunder.`,
    });
  } else if (totals.margin_usd != null && totals.margin_usd < 0) {
    out.push({
      id: "margin-negative",
      kind: "margin_risk",
      severity: "critical",
      confidence: clamp01(0.62 + 0.18 * clamp01(-totals.margin_usd / 50)),
      title: "Negativ margin på AI-linjen",
      detail: "Estimert AI-kostnad overstiger summert list MRR for selskaper med aktivitet denne perioden. Prioriter inntekts- eller kosttiltak.",
    });
  }

  for (const f of flagged_companies) {
    out.push({
      id: `flag-${f.company_id}`,
      kind: "billing_flag_followup",
      severity: "warn",
      confidence: 0.48,
      title: `Oppfølging: ${companyLabel(f.name, f.company_id)}`,
      detail: f.ai_billing_flag_reason
        ? `Selskap markert for AI-fakturering (${f.ai_billing_flag_reason}). Verifiser inkludert budsjett og eventuell overforbruk.`
        : "Selskap markert for AI-fakturering. Verifiser inkludert budsjett og eventuell overforbruk.",
      refs: { company_id: f.company_id, company_name: f.name },
    });
  }

  const totalToolCost = by_tool.reduce((s, t) => s + t.cost_estimate_usd, 0);
  if (totalToolCost > 0 && by_tool.length > 0) {
    const top = by_tool[0];
    const share = top.cost_estimate_usd / totalToolCost;
    if (share >= toolCostShareWarn && top.runs >= toolRunsMin && top.tool !== "unknown") {
      const sev = share >= 0.55 ? "critical" : "warn";
      const { confidence, confidence_factors } = confidenceBlockTool({
        share,
        runs: top.runs,
        runsMin: toolRunsMin,
        severity: sev,
      });
      out.push({
        id: `block-tool-${top.tool}`,
        kind: "block_tool",
        severity: sev,
        confidence,
        confidence_factors,
        title: `Vurder begrensning av verktøy`,
        detail: `«${top.tool}» står for ca. ${Math.round(share * 100)} % av AI-kostnad (${top.runs} kjøringer). Vurder midlertidig blokkering, rate limit eller billigere modell for dette verktøyet.`,
        refs: { tool: top.tool },
      });
    }
  }

  for (const c of top_companies) {
    if (c.list_mrr_usd != null && c.margin_vs_cost_usd != null && c.margin_vs_cost_usd < 0) {
      const { confidence, confidence_factors } = confidenceDowngradeModel({
        cost_estimate_usd: c.cost_estimate_usd,
        list_mrr_usd: c.list_mrr_usd,
        margin_vs_cost_usd: c.margin_vs_cost_usd,
      });
      out.push({
        id: `downgrade-${c.company_id}`,
        kind: "downgrade_model",
        severity: "warn",
        confidence,
        confidence_factors,
        title: `Vurder billigere modell for ${companyLabel(c.name, c.company_id)}`,
        detail: `Estimert AI-kostnad (${c.cost_estimate_usd.toFixed(2)} USD) overstiger list MRR (${c.list_mrr_usd.toFixed(2)} USD) for denne perioden. Senk modellnivå eller innfør tak før kostnaden eskalerer.`,
        refs: { company_id: c.company_id, company_name: c.name },
      });
    }

    if (
      c.plan === "basic" &&
      c.runs >= upsellBasicRuns &&
      c.cost_estimate_usd >= upsellBasicCostUsd
    ) {
      const act = clamp01(Math.min(1, (c.runs - upsellBasicRuns) / 120));
      out.push({
        id: `upsell-${c.company_id}`,
        kind: "upsell_plan",
        severity: "info",
        confidence: clamp01(0.38 + 0.22 * act),
        confidence_factors: { activity: act },
        title: `Oppsalg: ${companyLabel(c.name, c.company_id)}`,
        detail: `Høy aktivitet på Basic (${c.runs} kjøringer, ~${c.cost_estimate_usd.toFixed(2)} USD kost). Vurder Pro for høyere inkludert volum og bedre enhetsøkonomi.`,
        refs: { company_id: c.company_id, company_name: c.name },
      });
    }
  }

  const order = { critical: 0, warn: 1, info: 2 } as const;
  out.sort((a, b) => order[a.severity] - order[b.severity]);

  return out;
}

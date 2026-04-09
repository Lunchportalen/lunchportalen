import "server-only";

import { getPlanListMrrUsd } from "@/lib/ai/billing";
import { AI_RUNNER_LOG_ACTION, estimateUsageCostUsd, resolveUtcMonthBounds } from "@/lib/ai/usage";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PAGE_SIZE = 500;

function isCompanyUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

function numFromUnknown(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

function tokensFromRow(row: {
  metadata?: unknown;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
}): { prompt: number; completion: number } {
  const meta =
    row.metadata != null && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const prompt =
    numFromUnknown(meta.prompt_tokens) ||
    (typeof row.prompt_tokens === "number" && Number.isFinite(row.prompt_tokens) ? Math.max(0, row.prompt_tokens) : 0);
  const completion =
    numFromUnknown(meta.completion_tokens) ||
    (typeof row.completion_tokens === "number" && Number.isFinite(row.completion_tokens)
      ? Math.max(0, row.completion_tokens)
      : 0);
  return { prompt, completion };
}

function toolFromRow(row: { metadata?: unknown }): string {
  const meta =
    row.metadata != null && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const t = meta.tool;
  return typeof t === "string" && t.trim() ? t.trim() : "unknown";
}

export type PlatformAiToolRow = {
  tool: string;
  runs: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_estimate_usd: number;
};

export type PlatformAiCompanyRow = {
  company_id: string;
  name: string | null;
  plan: string;
  runs: number;
  cost_estimate_usd: number;
  list_mrr_usd: number | null;
  margin_vs_cost_usd: number | null;
  ai_billing_flagged: boolean;
  ai_billing_flag_reason: string | null;
};

export type PlatformAiBillingOverview = {
  scope: "platform";
  period: string;
  period_bounds_utc: { start: string; end: string };
  totals: {
    total_ai_cost_usd: number;
    total_list_mrr_usd: number | null;
    margin_usd: number | null;
    total_runs: number;
    /** True when at least one company with usage had no list MRR env — margin omitted */
    revenue_partial: boolean;
  };
  by_tool: PlatformAiToolRow[];
  top_companies: PlatformAiCompanyRow[];
  /** Companies with DB billing flag among those with usage */
  flagged_companies: { company_id: string; name: string | null; ai_billing_flag_reason: string | null }[];
  alerts: {
    margin_below_threshold: boolean;
    min_margin_usd: number;
    any_company_flagged: boolean;
  };
};

function envMinMarginUsd(): number {
  const raw = String(process.env.AI_DASHBOARD_MIN_MARGIN_USD ?? "").trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Superadmin platform snapshot: MTD (or month param) AI runner cost, MRR sum, margin, per-tool and top companies.
 */
export async function getPlatformAiBillingOverview(monthParam?: string | null): Promise<PlatformAiBillingOverview> {
  const period = resolveUtcMonthBounds(monthParam ?? null);

  const byCompany = new Map<
    string,
    { runs: number; prompt: number; completion: number; cost: number }
  >();
  const byTool = new Map<string, { runs: number; prompt: number; completion: number; cost: number }>();

  let offset = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin()
      .from("ai_activity_log")
      .select("entity_id, metadata, prompt_tokens, completion_tokens")
      .eq("action", AI_RUNNER_LOG_ACTION)
      .gte("created_at", period.periodStartIso)
      .lte("created_at", period.periodEndIso)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`AI_USAGE_READ_FAILED: ${error.message}`);
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const cid = typeof row.entity_id === "string" ? row.entity_id.trim() : "";
      if (!cid || !isCompanyUuid(cid)) continue;

      const { prompt, completion } = tokensFromRow(row);
      const cost = estimateUsageCostUsd(prompt, completion);
      const tool = toolFromRow(row);

      const cAgg = byCompany.get(cid) ?? { runs: 0, prompt: 0, completion: 0, cost: 0 };
      cAgg.runs += 1;
      cAgg.prompt += prompt;
      cAgg.completion += completion;
      cAgg.cost += cost;
      byCompany.set(cid, cAgg);

      const tAgg = byTool.get(tool) ?? { runs: 0, prompt: 0, completion: 0, cost: 0 };
      tAgg.runs += 1;
      tAgg.prompt += prompt;
      tAgg.completion += completion;
      tAgg.cost += cost;
      byTool.set(tool, tAgg);
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const companyIds = [...byCompany.keys()];
  const companyMeta = new Map<
    string,
    { name: string | null; plan: string; flagged: boolean; reason: string | null }
  >();

  if (companyIds.length > 0) {
    const chunk = 200;
    for (let i = 0; i < companyIds.length; i += chunk) {
      const slice = companyIds.slice(i, i + chunk);
      const { data: comps, error: cErr } = await supabaseAdmin()
        .from("companies")
        .select("id, name, saas_plan, ai_billing_flagged, ai_billing_flag_reason")
        .in("id", slice);

      if (cErr) {
        throw new Error(`ENTITLEMENTS_READ_FAILED: ${cErr.message}`);
      }

      for (const c of Array.isArray(comps) ? comps : []) {
        const id = typeof c.id === "string" ? c.id : "";
        if (!id) continue;
        companyMeta.set(id, {
          name: typeof c.name === "string" ? c.name : null,
          plan: typeof c.saas_plan === "string" ? c.saas_plan : "none",
          flagged: Boolean(c.ai_billing_flagged),
          reason: typeof c.ai_billing_flag_reason === "string" ? c.ai_billing_flag_reason : null,
        });
      }
    }
  }

  let totalCost = 0;
  let totalRuns = 0;
  let totalMrr = 0;
  let revenuePartial = false;

  const companyRows: PlatformAiCompanyRow[] = [];

  for (const [companyId, agg] of byCompany) {
    totalCost += agg.cost;
    totalRuns += agg.runs;
    const meta = companyMeta.get(companyId);
    const plan = meta?.plan ?? "none";
    const mrr = getPlanListMrrUsd(plan);
    if (mrr == null) revenuePartial = true;
    else totalMrr += mrr;

    const margin = mrr != null ? mrr - agg.cost : null;

    companyRows.push({
      company_id: companyId,
      name: meta?.name ?? null,
      plan,
      runs: agg.runs,
      cost_estimate_usd: Number(agg.cost.toFixed(6)),
      list_mrr_usd: mrr,
      margin_vs_cost_usd: margin != null ? Number(margin.toFixed(6)) : null,
      ai_billing_flagged: meta?.flagged ?? false,
      ai_billing_flag_reason: meta?.reason ?? null,
    });
  }

  companyRows.sort((a, b) => b.cost_estimate_usd - a.cost_estimate_usd);
  const topCompanies = companyRows.slice(0, 25);

  const byToolArr: PlatformAiToolRow[] = [...byTool.entries()]
    .map(([tool, a]) => ({
      tool,
      runs: a.runs,
      prompt_tokens: a.prompt,
      completion_tokens: a.completion,
      cost_estimate_usd: Number(a.cost.toFixed(6)),
    }))
    .sort((x, y) => y.cost_estimate_usd - x.cost_estimate_usd);

  const flaggedCompanies = companyRows
    .filter((r) => r.ai_billing_flagged)
    .map((r) => ({
      company_id: r.company_id,
      name: r.name,
      ai_billing_flag_reason: r.ai_billing_flag_reason,
    }));

  const totalListMrrUsd = revenuePartial ? null : Number(totalMrr.toFixed(6));
  const marginUsd =
    totalListMrrUsd != null ? Number((totalListMrrUsd - Number(totalCost.toFixed(6))).toFixed(6)) : null;

  const minMargin = envMinMarginUsd();
  const marginBelow = marginUsd != null && marginUsd < minMargin;

  return {
    scope: "platform",
    period: period.periodLabel,
    period_bounds_utc: {
      start: period.periodStartIso,
      end: period.periodEndIso,
    },
    totals: {
      total_ai_cost_usd: Number(totalCost.toFixed(6)),
      total_list_mrr_usd: totalListMrrUsd,
      margin_usd: marginUsd,
      total_runs: totalRuns,
      revenue_partial: revenuePartial,
    },
    by_tool: byToolArr,
    top_companies: topCompanies,
    flagged_companies: flaggedCompanies,
    alerts: {
      margin_below_threshold: marginBelow,
      min_margin_usd: minMargin,
      any_company_flagged: flaggedCompanies.length > 0,
    },
  };
}

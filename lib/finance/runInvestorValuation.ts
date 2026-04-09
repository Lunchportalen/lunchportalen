import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { estimateARR } from "@/lib/finance/arr";
import { computeGrowth } from "@/lib/finance/growth";
import { computeKPIs, type OrderLike } from "@/lib/finance/kpis";
import { computeScenarios } from "@/lib/finance/scenarios";
import { computeValuation } from "@/lib/finance/valuation";
import { normalizeLeadPipelineRow } from "@/lib/pipeline/dealNormalize";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "investor_valuation";

export type InvestorValuationPayload = {
  kpis: ReturnType<typeof computeKPIs>;
  arr: ReturnType<typeof estimateARR>;
  growthRate: number;
  growthExplain: string[];
  valuation: ReturnType<typeof computeValuation>;
  scenarios: ReturnType<typeof computeScenarios>;
  sources: string[];
};

const GROWTH_EXPLAIN = [
  "Vekst = (omsetning andre halvdel − første halvdel) / første halvdel på ordre sortert kronologisk.",
  "Krever minst to ordre med beløp og dato.",
];

async function logValuationRun(opts: {
  rid: string;
  payload: InvestorValuationPayload;
}): Promise<void> {
  try {
    if (!hasSupabaseAdminConfig()) return;
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "valuation_run",
      metadata: {
        valuation: opts.payload.valuation.valuation,
        arr: opts.payload.arr.arr,
        multiple: opts.payload.valuation.multiple,
        growth_rate: opts.payload.growthRate,
        mode: "indicative_only",
      },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid: opts.rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[investorValuation] log", error.message);
  } catch (e) {
    console.error("[investorValuation] log", e instanceof Error ? e.message : String(e));
  }
}

/**
 * Henter ordre + pipeline (service role), beregner KPI, ARR, vekst, verdivurdering og scenarioer.
 */
export async function buildInvestorValuationResult(opts: {
  log?: boolean;
  rid?: string;
}): Promise<InvestorValuationPayload> {
  const sources: string[] = [
    "Ordre: `public.orders.line_total`, `created_at` (maks 8000 siste rader).",
    "Pipeline: `lead_pipeline` via normaliserte deals (value_estimate × sannsynlighet).",
  ];

  const empty: InvestorValuationPayload = {
    kpis: { revenue: 0, deals: 0, weightedPipeline: 0, pipelineGross: 0 },
    arr: {
      arr: 0,
      monthlyRunRate: 0,
      monthsObserved: 0,
      explain: ["Ingen data — fail-closed."],
    },
    growthRate: 0,
    growthExplain: GROWTH_EXPLAIN,
    valuation: {
      multiple: 2,
      valuation: 0,
      explain: ["Ingen ARR — verdi 0."],
    },
    scenarios: computeScenarios(0),
    sources,
  };

  if (!hasSupabaseAdminConfig()) {
    return { ...empty, sources: [...sources, "Supabase admin ikke konfigurert."] };
  }

  try {
    const admin = supabaseAdmin();
    const oOk = await verifyTable(admin, "orders", ROUTE);
    const pOk = await verifyTable(admin, "lead_pipeline", ROUTE);
    if (!oOk) {
      return { ...empty, sources: [...sources, "orders-tabell utilgjengelig."] };
    }

    const { data: orderRows, error: oErr } = await admin
      .from("orders")
      .select("line_total, created_at")
      .order("created_at", { ascending: true })
      .limit(8000);

    const orders: OrderLike[] = !oErr && Array.isArray(orderRows) ? (orderRows as OrderLike[]) : [];

    let pipelineDeals: Array<{ value: number; probability: number }> = [];
    if (pOk) {
      const { data: pipeRows, error: pErr } = await admin.from("lead_pipeline").select("*").limit(500);
      if (!pErr && Array.isArray(pipeRows)) {
        pipelineDeals = pipeRows
          .map((r) => normalizeLeadPipelineRow(r as Record<string, unknown>))
          .filter((d): d is NonNullable<typeof d> => d != null)
          .map((d) => ({ value: d.value, probability: d.probability }));
      }
    }

    const kpis = computeKPIs({ orders, pipelineDeals });
    const arr = estimateARR(orders);
    const growthRate = computeGrowth(orders);
    const valuation = computeValuation({ arr: arr.arr, growthRate });
    const scenarios = computeScenarios(valuation.valuation);

    const payload: InvestorValuationPayload = {
      kpis,
      arr,
      growthRate,
      growthExplain: GROWTH_EXPLAIN,
      valuation,
      scenarios,
      sources,
    };

    if (opts.log === true) {
      await logValuationRun({ rid: opts.rid ?? `valuation_${Date.now().toString(36)}`, payload });
    }

    return payload;
  } catch (e) {
    console.error("[investorValuation]", e instanceof Error ? e.message : String(e));
    return { ...empty, sources: [...sources, "Uventet feil — returnerer tom indikator (fail-closed)."] };
  }
}

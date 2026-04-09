import "server-only";

import type { AnalyzeBusinessInput } from "@/lib/ceo/engine";
import { runCeoEngine } from "@/lib/ceo/run";
import { loadCeoEngineInputs } from "@/lib/ceo/loadEngineInputs";
import { AgentBus } from "@/lib/agents/bus";
import type { MarketDef } from "@/lib/global/markets";
import { filterPipelineRowsForMarket } from "@/lib/global/marketIsolation";
import type { EnrichedPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { runSalesAgent } from "@/lib/sales/runAgent";
import { runSocialAutonomyCycleFromDb } from "@/lib/social/autonomousRunner";

const EMPTY_CEO_INPUT: AnalyzeBusinessInput = {
  pipeline: { deals: 0, totalValue: 0, weightedValue: 0, dealsList: [] },
  social: { posts: [] },
  revenue: { revenue: 0, forecast: 0 },
  flags: { socialLoaded: false },
};

export type MarketAgentBundle = {
  ceo: ReturnType<typeof runCeoEngine>;
  growth:
    | Awaited<ReturnType<typeof runSocialAutonomyCycleFromDb>>
    | { ok: false; reason: string };

  sales:
    | Awaited<ReturnType<typeof runSalesAgent>>
    | { error: true; reason: string };

  content: { status: "skipped"; reason: string };
};

/**
 * Kjør agenter for **ett** marked. Én agent feiler ikke de andre (inner try/catch).
 */
export async function runAgents(opts: { market: MarketDef; data?: unknown }): Promise<MarketAgentBundle> {
  const { market } = opts;
  const marketId = market.id;

  AgentBus.publish({ type: "orchestrator_start", marketId, payload: { marketId } });

  const input = await loadCeoEngineInputs({
    filterPipelineRows: (rows) => filterPipelineRowsForMarket(rows, marketId),
  });

  let ceo: ReturnType<typeof runCeoEngine>;
  try {
    ceo = runCeoEngine(input);
    AgentBus.publish({ type: "ceo_done", marketId, agent: "ceo", payload: { insights: ceo.insights.length } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ceo = runCeoEngine(EMPTY_CEO_INPUT);
    AgentBus.publish({ type: "ceo_failed", marketId, agent: "ceo", payload: { error: msg } });
  }

  let growth: MarketAgentBundle["growth"];
  try {
    if (marketId !== "no") {
      growth = { ok: false, reason: "growth_cycle_wired_for_no_only" };
    } else {
      growth = await runSocialAutonomyCycleFromDb();
    }
    AgentBus.publish({ type: "growth_done", marketId, agent: "growth", payload: { ok: growth.ok } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    growth = { ok: false, reason: `growth_error:${msg}` };
    AgentBus.publish({ type: "growth_failed", marketId, agent: "growth", payload: { error: msg } });
  }

  let sales: MarketAgentBundle["sales"];
  try {
    const deals = input.pipeline.dealsList as EnrichedPipelineDeal[];
    sales = await runSalesAgent(deals, {
      idempotencyPrefix: `global_${marketId}_${Date.now().toString(36)}`,
      actorEmail: null,
    });
    AgentBus.publish({ type: "sales_done", marketId, agent: "sales", payload: { queue: sales.queue.length } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    sales = { error: true, reason: msg };
    AgentBus.publish({ type: "sales_failed", marketId, agent: "sales", payload: { error: msg } });
  }

  const content: MarketAgentBundle["content"] = {
    status: "skipped",
    reason: "content_agent_requires_product_context",
  };
  AgentBus.publish({ type: "content_skipped", marketId, agent: "content", payload: content });

  AgentBus.publish({ type: "orchestrator_done", marketId });

  return { ceo, growth, sales, content };
}

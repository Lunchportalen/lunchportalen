import "server-only";

import type { MarketAgentBundle } from "@/lib/agents/orchestrator";
import { runAgents } from "@/lib/agents/orchestrator";
import { logGlobalMarketEvent } from "@/lib/global/globalAudit";
import { MARKETS, type MarketDef } from "@/lib/global/markets";
import { GLOBAL_SCALING } from "@/lib/global/scaling";
import { makeRid } from "@/lib/http/respond";

export function resolveMarketEnabled(market: MarketDef, overrides?: Record<string, boolean>): boolean {
  if (overrides && typeof overrides[market.id] === "boolean") {
    return overrides[market.id]!;
  }
  return market.enabled;
}

function summarizeBundle(r: MarketAgentBundle): Record<string, unknown> {
  const salesLen = "queue" in r.sales ? r.sales.queue.length : -1;
  return {
    ceoInsights: r.ceo.insights.length,
    growthOk: r.growth.ok === true,
    salesQueue: salesLen,
    content: r.content.status,
  };
}

export type RunGlobalSystemResult = {
  markets: Record<string, MarketAgentBundle>;
  errors: Record<string, string>;
  rid: string;
};

/**
 * Kjør orkestrering per aktivert marked — feil i ett marked stopper ikke andre.
 */
export async function runGlobalSystem(opts?: {
  marketOverrides?: Record<string, boolean>;
  actorEmail?: string | null;
  rid?: string;
}): Promise<RunGlobalSystemResult> {
  const rid = opts?.rid ?? makeRid("global_run");
  const markets: Record<string, MarketAgentBundle> = {};
  const errors: Record<string, string> = {};

  let ran = 0;
  for (const market of MARKETS) {
    if (!resolveMarketEnabled(market, opts?.marketOverrides)) continue;

    if (ran >= GLOBAL_SCALING.maxMarketsPerRun) {
      errors[market.id] = "max_markets_per_run_cap";
      continue;
    }

    try {
      await logGlobalMarketEvent({
        rid,
        marketId: market.id,
        phase: "start",
        actorEmail: opts?.actorEmail ?? null,
      });

      const r = await runAgents({ market, data: {} });
      markets[market.id] = r;

      await logGlobalMarketEvent({
        rid,
        marketId: market.id,
        phase: "done",
        actorEmail: opts?.actorEmail ?? null,
        summary: summarizeBundle(r),
      });
      ran += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors[market.id] = msg;
      await logGlobalMarketEvent({
        rid,
        marketId: market.id,
        phase: "error",
        actorEmail: opts?.actorEmail ?? null,
        summary: { error: msg },
      });
    }
  }

  return { markets, errors, rid };
}

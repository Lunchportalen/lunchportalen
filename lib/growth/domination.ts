import "server-only";

import { improveContent } from "@/lib/content/improve";
import { generateVariants } from "@/lib/content/variants";
import { amplify } from "@/lib/growth/amplify";
import { getMarketData } from "@/lib/market/marketData";
import { detectTrends } from "@/lib/market/trends";
import { opsLog } from "@/lib/ops/log";

function dominationBlocked(): boolean {
  return (
    String(process.env.LP_SCALE_KILL_SWITCH ?? "").trim() === "true" ||
    String(process.env.LP_DOMINATION_KILL_SWITCH ?? "").trim() === "true"
  );
}

export type DominationRunStatus = "ok" | "blocked" | "no_data" | "dry_run";

/**
 * Orkestrering — ingen eksekvering av amplify før LP_DOMINATION_EXEC_ENABLED=true (unngår utilsiktet publisering).
 */
export async function runDomination(): Promise<{
  trend: string | null;
  variants: number;
  status: DominationRunStatus;
}> {
  if (dominationBlocked()) {
    opsLog("domination_blocked", { reason: "kill_switch" });
    return { trend: null, variants: 0, status: "blocked" };
  }

  const marketData = await getMarketData();
  if (marketData.length === 0) {
    opsLog("domination_skip", { reason: "no_market_data" });
    return { trend: null, variants: 0, status: "no_data" };
  }

  const trend = detectTrends(
    marketData.map((d) => ({
      signals: { format: d.signals.format },
      engagement: d.engagement,
    })),
  );

  const sorted = [...marketData].sort((a, b) => {
    if (b.engagement !== a.engagement) return b.engagement - a.engagement;
    return a.id.localeCompare(b.id, "nb");
  });
  const best = sorted[0];
  if (!best) {
    opsLog("domination_skip", { reason: "empty_after_sort" });
    return { trend, variants: 0, status: "no_data" };
  }

  const improved = improveContent({ ...best, text: best.text }, best.signals);
  const variants = generateVariants(improved);

  const exec = String(process.env.LP_DOMINATION_EXEC_ENABLED ?? "").trim() === "true";
  if (!exec) {
    opsLog("domination_dry_run", { trend, variantCount: variants.length });
    return { trend, variants: variants.length, status: "dry_run" };
  }

  for (const v of variants) {
    await amplify(v);
  }

  opsLog("domination_complete", { trend, variantCount: variants.length });
  return { trend, variants: variants.length, status: "ok" };
}

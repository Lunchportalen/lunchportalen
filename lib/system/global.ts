import "server-only";

import { generateDominationStrategy } from "@/lib/market/dominate";
import { getMarketSignals } from "@/lib/market/signals";
import { getCachedSettings } from "@/lib/settings/cache";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Global koordinering — LLM kjøres ikke uten opts.approved === true.
 */
export async function runGlobalControl(opts?: { approved?: boolean }): Promise<unknown> {
  const sb = await supabaseServer();
  const settings = await getCachedSettings(sb);

  if (!settings?.toggles?.autonomy_master_enabled) {
    console.log("[GLOBAL_STRATEGY]", { skipped: "AUTONOMY_DISABLED" });
    return { skipped: "AUTONOMY_DISABLED" as const };
  }

  const signals = getMarketSignals();

  if (opts?.approved !== true) {
    console.log("[GLOBAL_STRATEGY]", { status: "requires_approval", signals });
    return { status: "requires_approval" as const, signals };
  }

  const strategy = await generateDominationStrategy(signals);
  console.log("[GLOBAL_STRATEGY]", strategy);
  return { status: "planned" as const, strategy };
}

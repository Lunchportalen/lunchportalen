import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runAutonomy } from "@/lib/autonomy/orchestrator";
import { runSalesAI } from "@/lib/sales/engine";
import { getCachedSettings } from "@/lib/settings/cache";
import type { Database } from "@/lib/types/database";

export type SystemRunResult =
  | { ok: false; error: "SETTINGS_UNAVAILABLE" }
  | {
      ok: true;
      autonomy: Awaited<ReturnType<typeof runAutonomy>>;
      sales: Awaited<ReturnType<typeof runSalesAI>>;
    };

/**
 * Samler autonomi + salg (tom lead-liste = ingen salgs-signaler / inntekts-hooks).
 * Autonomi er allerede styrt av toggles/killswitch i runAutonomy.
 */
export async function runSystem(sb: SupabaseClient<Database>): Promise<SystemRunResult> {
  const settings = await getCachedSettings(sb);

  if (!settings) {
    return { ok: false, error: "SETTINGS_UNAVAILABLE" };
  }

  const autonomy = await runAutonomy(sb, settings);
  const sales = await runSalesAI([]);

  console.log("[AI_SYSTEM]", {
    phase: "system_orchestrator",
    autonomySkipped: "skipped" in autonomy ? autonomy.skipped : undefined,
    salesCount: sales.length,
  });

  return { ok: true, autonomy, sales };
}

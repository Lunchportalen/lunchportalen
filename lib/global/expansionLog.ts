/**
 * Audit for global ekspansjon — ingen sideeffekter utenom logg.
 */
import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "market_expansion_audit";

export async function logMarketExpansion(
  rid: string,
  metadata: {
    market: string | null;
    pilotDraftCount: number;
    scoredMarkets: string[];
  },
): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "market_expansion",
      metadata: {
        ...metadata,
        rid,
        success: null,
      },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[market_expansion]", error.message);
  } catch (e) {
    console.error("[market_expansion]", e instanceof Error ? e.message : String(e));
  }
}

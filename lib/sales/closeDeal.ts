/**
 * Marker «klar til lukking» uten å tvinge terminalstatus (won/lost forblir manuelt).
 */
import "server-only";

import { resolvePipelineStage } from "@/lib/pipeline/dealNormalize";
import type { PrioritizedLead } from "@/lib/pipeline/prioritize";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "try_close_deal";

export async function tryCloseDeal(lead: PrioritizedLead, rid: string): Promise<{ updated: boolean }> {
  if (!hasSupabaseAdminConfig()) return { updated: false };

  const id = typeof lead.id === "string" ? lead.id : "";
  if (!id) return { updated: false };

  const rawMeta = lead.meta;
  const meta =
    rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
      ? { ...(rawMeta as Record<string, unknown>) }
      : {};

  const stage = resolvePipelineStage(lead as unknown as Record<string, unknown>);
  if (stage === "won" || stage === "lost") return { updated: false };

  const prob = typeof meta.predicted_probability === "number" && Number.isFinite(meta.predicted_probability)
    ? meta.predicted_probability
    : 0;

  if (prob < 80) return { updated: false };

  if (meta.ready_to_close === true) return { updated: false };

  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "lead_pipeline", ROUTE);
    if (!ok) return { updated: false };

    const nextMeta = {
      ...meta,
      ready_to_close: true,
      ready_to_close_at: new Date().toISOString(),
      ready_to_close_rid: rid,
    };

    const { error } = await admin.from("lead_pipeline").update({ meta: nextMeta }).eq("id", id);
    if (error) {
      console.error("[tryCloseDeal]", id, error.message);
      return { updated: false };
    }
    console.log("[READY_TO_CLOSE]", { leadId: id, rid });
    return { updated: true };
  } catch (e) {
    console.error("[tryCloseDeal_fatal]", e instanceof Error ? e.message : String(e));
    return { updated: false };
  }
}

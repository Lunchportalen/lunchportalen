/**
 * Read last design_optimizer apply from ai_activity_log for rapid-toggle policy.
 */

import "server-only";

import { opsLog } from "@/lib/ops/log";
import type { DesignSettingsDocument } from "@/lib/cms/design/designContract";
import { supabaseAdmin } from "@/lib/supabase/admin";

import { designPatchAffectedKeys, type LastDesignApplySnapshot } from "./designPolicy";

export async function fetchLastDesignOptimizerApply(): Promise<LastDesignApplySnapshot | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_activity_log")
      .select("metadata, created_at")
      .eq("action", "design_optimizer_apply")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      opsLog("design.last_apply_query_error", { message: error.message, code: error.code ?? null });
      return null;
    }
    if (!data) return null;
    const row = data as { metadata?: unknown; created_at?: string | null };
    const meta = row.metadata != null && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
    const patch = meta?.appliedPatch;
    const keys =
      patch != null && typeof patch === "object" && !Array.isArray(patch)
        ? designPatchAffectedKeys(patch as DesignSettingsDocument)
        : [];
    const atRaw = row.created_at;
    const at = typeof atRaw === "string" ? new Date(atRaw).getTime() : Date.now();
    return { at, keys };
  } catch (e) {
    opsLog("design.last_apply_fetch_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

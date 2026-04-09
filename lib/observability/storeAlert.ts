import "server-only";

import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function storeAlert(type: string, payload: Record<string, unknown>): Promise<void> {
  const t = String(type ?? "").trim();
  if (!t) return;
  try {
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("ai_alerts").insert({ type: t, payload });
    if (error) {
      opsLog("alert_store_failed", { type: t, error: error.message });
      return;
    }
    opsLog("alert_stored", { type: t });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("alert_store_failed", { type: t, error: message });
  }
}

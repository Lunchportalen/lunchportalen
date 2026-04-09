import "server-only";

import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function loadSequenceModel(): Promise<unknown | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_models")
      .select("model")
      .eq("model_type", "sequence")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      opsLog("sequence_model_load_failed", { message: error.message });
      return null;
    }
    const row = data as { model?: unknown } | null;
    return row?.model ?? null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("sequence_model_load_failed", { message });
    return null;
  }
}

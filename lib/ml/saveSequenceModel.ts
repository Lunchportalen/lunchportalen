import "server-only";

import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function saveSequenceModel(model: unknown): Promise<boolean> {
  try {
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("ai_models").insert({ model, model_type: "sequence" });
    if (error) {
      opsLog("sequence_model_save_failed", { message: error.message });
      return false;
    }
    opsLog("sequence_model_saved", { ok: true });
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("sequence_model_save_failed", { message });
    return false;
  }
}

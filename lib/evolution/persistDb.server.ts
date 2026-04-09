import "server-only";

/**
 * Optional: call from a Server Action or `app/api/**` route only — not from `tsx` CLI.
 * Persists evolution steps to `public.ai_activity_log` when service role is configured.
 */
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { makeRid } from "@/lib/http/respond";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export async function insertEvolutionAiLog(payload: Record<string, unknown>): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  const admin = supabaseAdmin();
  const row = buildAiActivityLogRow({
    action: "architecture_evolution",
    metadata: payload,
  });
  const rid = makeRid("evo");
  await admin.from("ai_activity_log").insert({
    ...row,
    rid,
    status: "success",
  } as Record<string, unknown>);
}

/**
 * Writes to public.ai_activity_log for both slim (entity_*) and legacy (tool/env/locale) PostgREST schemas.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiActivityLogRow } from "./aiActivityLogRow";

export type AiActivityLogLegacyContext = {
  tool: string;
  environment: string;
  locale: string;
  actorEmail: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  model: string | null;
};

function unknownAiLogColumn(err: { code?: string; message?: string } | null, column: string): boolean {
  if (!err || err.code !== "PGRST204") return false;
  const m = String(err.message ?? "");
  return m.includes(`'${column}'`) && m.includes("ai_activity_log");
}

export async function insertAiActivityLogCompat(
  supabase: SupabaseClient,
  row: AiActivityLogRow,
  legacy: AiActivityLogLegacyContext,
): Promise<{ error: { message: string; code?: string } | null }> {
  let res = await supabase.from("ai_activity_log").insert(row);
  if (!res.error) return { error: null };

  if (unknownAiLogColumn(res.error, "entity_type") || unknownAiLogColumn(res.error, "actor_user_id")) {
    const metadata: Record<string, unknown> = {
      ...(row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {}),
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      actor_user_id: row.actor_user_id,
      trace_actor_email: legacy.actorEmail,
    };
    const legacyRow: Record<string, unknown> = {
      page_id: row.page_id,
      variant_id: row.variant_id,
      environment: legacy.environment,
      locale: legacy.locale,
      action: row.action,
      tool: legacy.tool,
      prompt_tokens: legacy.prompt_tokens,
      completion_tokens: legacy.completion_tokens,
      model: legacy.model,
      metadata,
    };
    res = await supabase.from("ai_activity_log").insert(legacyRow);
  }

  return { error: res.error };
}

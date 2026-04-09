/**
 * Inserts into public.ai_suggestions across PostgREST schema variants.
 * Some live databases expose the table without an `input` column (PGRST204); we then persist
 * input + suggestion inside output under _lp_suggest_envelope_v1 for traceability.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const AI_SUGGEST_ENVELOPE_V1 = "_lp_suggest_envelope_v1" as const;

export type AiSuggestionInsertPayload = {
  page_id: string | null;
  variant_id: string | null;
  environment: string;
  locale: string;
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

function isMissingAiSuggestionsColumn(err: { code?: string; message?: string } | null, column: string): boolean {
  if (!err || err.code !== "PGRST204") return false;
  const m = String(err.message ?? "");
  return m.includes(`'${column}'`) && m.includes("ai_suggestions");
}

export async function insertAiSuggestionRow(
  supabase: SupabaseClient,
  payload: AiSuggestionInsertPayload,
): Promise<{ data: { id: string } | null; error: { message: string; code?: string; details?: string | null; hint?: string | null } | null }> {
  const base = {
    page_id: payload.page_id,
    variant_id: payload.variant_id,
    environment: payload.environment,
    locale: payload.locale,
    tool: payload.tool,
  };

  let res = await supabase
    .from("ai_suggestions")
    .insert({
      ...base,
      input: payload.input,
      output: payload.output,
    })
    .select("id")
    .single();

  if (!res.error && res.data && typeof (res.data as { id?: unknown }).id === "string") {
    return { data: res.data as { id: string }, error: null };
  }

  if (res.error && isMissingAiSuggestionsColumn(res.error, "input")) {
    res = await supabase
      .from("ai_suggestions")
      .insert({
        ...base,
        output: {
          [AI_SUGGEST_ENVELOPE_V1]: { input: payload.input, suggestion: payload.output },
        },
      })
      .select("id")
      .single();
  }

  if (!res.error && res.data && typeof (res.data as { id?: unknown }).id === "string") {
    return { data: res.data as { id: string }, error: null };
  }

  return { data: null, error: res.error };
}

/** Normalizes DB row for API consumers (unwrap envelope when input column was not used). */
export function unwrapAiSuggestionStoredFields(row: { input: unknown; output: unknown }): {
  input: unknown;
  output: unknown;
} {
  const out = row.output;
  if (out && typeof out === "object" && !Array.isArray(out)) {
    const env = (out as Record<string, unknown>)[AI_SUGGEST_ENVELOPE_V1];
    if (env && typeof env === "object" && !Array.isArray(env)) {
      const envObj = env as Record<string, unknown>;
      return {
        input: envObj.input ?? row.input ?? null,
        output: envObj.suggestion ?? out,
      };
    }
  }
  return { input: row.input, output: row.output };
}

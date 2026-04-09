import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

export type SystemSettingsRow = Database["public"]["Tables"]["system_settings"]["Row"];
export type SystemSettingsRepositoryError = {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

const SYSTEM_SETTINGS_COLUMNS = "id,toggles,killswitch,retention,updated_at,updated_by" as const;

/**
 * Single query contract for `public.system_settings` reads (no ad-hoc chains in feature code).
 */
export async function fetchSystemSettingsRow(
  sb: SupabaseClient<Database>,
): Promise<{ data: SystemSettingsRow | null; error: SystemSettingsRepositoryError | null }> {
  const { data, error } = await sb
    .from("system_settings")
    .select(SYSTEM_SETTINGS_COLUMNS)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error: {
        message: error.message,
        code: typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : null,
        details:
          typeof (error as { details?: unknown }).details === "string"
            ? (error as { details: string }).details
            : null,
        hint:
          typeof (error as { hint?: unknown }).hint === "string"
            ? (error as { hint: string }).hint
            : null,
      },
    };
  }
  return { data, error: null };
}

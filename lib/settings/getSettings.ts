import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { readSystemSettingsBaseline } from "@/lib/system/settings";
import type { Database } from "@/lib/types/database";

/**
 * Compatibility helper for legacy callers that expect a loose settings payload.
 * Reads through the canonical system-settings baseline path and always returns
 * the fail-closed settings snapshot instead of collapsing to `null`.
 */
export async function getSettings(sb: SupabaseClient<Database>) {
  const { settings } = await readSystemSettingsBaseline({
    sb,
    source: "request_scope",
  });
  return settings;
}

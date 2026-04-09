import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { getSystemSettingsSafe, type SystemSettings } from "@/lib/system/settings";

let SETTINGS_CACHE: SystemSettings | null = null;
let SETTINGS_LAST_FETCH = 0;

const TTL_MS = 5000;

/** Invalidate after superadmin writes so next read is fresh (no TTL wait). */
export function invalidateSettingsCache(): void {
  SETTINGS_CACHE = null;
  SETTINGS_LAST_FETCH = 0;
}

/**
 * Short-TTL server cache for system_settings (single row).
 * - Fail-soft: returns last good cache on transient fetch errors if available.
 * - Fail-closed callers should treat `null` as “settings unavailable”.
 */
export async function getCachedSettings(sb: SupabaseClient<Database>): Promise<SystemSettings | null> {
  const now = Date.now();

  if (SETTINGS_CACHE && now - SETTINGS_LAST_FETCH < TTL_MS) {
    return SETTINGS_CACHE;
  }

  const fresh = await getSystemSettingsSafe(sb);

  if (fresh) {
    SETTINGS_CACHE = fresh;
    SETTINGS_LAST_FETCH = now;
  } else if (!SETTINGS_CACHE) {
    return null;
  }

  return SETTINGS_CACHE;
}

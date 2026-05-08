import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { setAutopilotRuntimeOverride } from "@/lib/autopilot/kill-switch";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type AutopilotSettingsSyncOk = {
  ok: true;
  rowId: string;
  enabled: boolean;
};

export type AutopilotSettingsSyncErr = {
  ok: false;
  message: string;
  error: unknown;
};

function safeBool(value: unknown): boolean {
  return value === true;
}

export async function syncAutopilotRuntimeFromSystemSettings(
  client?: SupabaseClient,
): Promise<AutopilotSettingsSyncOk | AutopilotSettingsSyncErr> {
  try {
    const admin = client ?? supabaseAdmin();
    const { data, error } = await admin
      .from("system_settings")
      .select("id,autopilot_enabled")
      .limit(1)
      .maybeSingle();

    if (error || !data || (data as { id?: unknown }).id == null) {
      return {
        ok: false,
        message: "Kunne ikke lese system_settings.autopilot_enabled.",
        error: error ?? "SYSTEM_SETTINGS_ROW_MISSING",
      };
    }

    const enabled = safeBool((data as { autopilot_enabled?: unknown }).autopilot_enabled);
    setAutopilotRuntimeOverride(enabled);

    return {
      ok: true,
      rowId: String((data as { id: unknown }).id),
      enabled,
    };
  } catch (error) {
    return {
      ok: false,
      message: "Kunne ikke synkronisere autopilot fra system_settings.",
      error,
    };
  }
}

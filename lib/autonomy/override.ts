import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { opsLog } from "@/lib/ops/log";

import type { AutonomyMode } from "./types";

import { getAutonomyEnvConfig, type AutonomyConfigResolved } from "./config";

export const AUTONOMY_CONFIG_KIND = "autonomy_config" as const;

export type AutonomyOverridePayload = {
  enabled?: boolean;
  mode?: AutonomyMode;
};

/**
 * Last persisted superadmin override (audit row), merged over env.
 */
export async function loadAutonomyOverride(admin: SupabaseClient): Promise<AutonomyOverridePayload | null> {
  const { data, error } = await admin
    .from("ai_activity_log")
    .select("metadata, created_at")
    .eq("action", "audit")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !Array.isArray(data)) {
    return null;
  }

  for (const row of data) {
    const m = row?.metadata as Record<string, unknown> | undefined;
    if (!m || m.kind !== AUTONOMY_CONFIG_KIND) continue;
    const enabled = typeof m.enabled === "boolean" ? m.enabled : undefined;
    const modeRaw = m.mode;
    const mode =
      modeRaw === "dry-run" || modeRaw === "semi" || modeRaw === "auto" ? modeRaw : undefined;
    return { enabled, mode };
  }

  return null;
}

export function mergeAutonomyConfig(
  envCfg: ReturnType<typeof getAutonomyEnvConfig>,
  override: AutonomyOverridePayload | null
): AutonomyConfigResolved {
  if (!override) {
    return { ...envCfg, source: "env" };
  }
  return {
    ...envCfg,
    enabled: override.enabled !== undefined ? override.enabled : envCfg.enabled,
    mode: override.mode !== undefined ? override.mode : envCfg.mode,
    source: "merged",
  };
}

export async function persistAutonomyOverride(
  admin: SupabaseClient,
  payload: AutonomyOverridePayload & { rid: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = buildAiActivityLogRow({
    action: "audit",
    metadata: {
      kind: AUTONOMY_CONFIG_KIND,
      rid: payload.rid,
      enabled: payload.enabled,
      mode: payload.mode,
      updatedAt: new Date().toISOString(),
    },
  });

  const { error } = await admin.from("ai_activity_log").insert(row as Record<string, unknown>);
  if (error) {
    opsLog("autonomy_config_persist_failed", { message: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

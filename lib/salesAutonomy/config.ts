import type { AutonomyMode, AutonomyRuntimeConfig } from "@/lib/salesAutonomy/types";

export const AUTONOMY_CONFIG = {
  enabled: false,
  mode: "dry-run" as AutonomyMode,
  maxEmailsPerDay: 20,
  maxActionsPerRun: 10,
  requireApproval: true,
} as const;

export function isAutonomyEnvUnlocked(): boolean {
  return process.env.AUTONOMY_ENABLED === "true";
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function normalizeMode(m: unknown): AutonomyMode {
  if (m === "dry-run" || m === "semi" || m === "full") return m;
  return "dry-run";
}

export function resolveAutonomyConfig(overrides?: Partial<AutonomyRuntimeConfig>): AutonomyRuntimeConfig {
  const maxEmails = clampInt(overrides?.maxEmailsPerDay ?? AUTONOMY_CONFIG.maxEmailsPerDay, 0, 20);
  const maxActions = clampInt(overrides?.maxActionsPerRun ?? AUTONOMY_CONFIG.maxActionsPerRun, 0, 50);
  const mode = normalizeMode(overrides?.mode ?? AUTONOMY_CONFIG.mode);
  const requireApproval = overrides?.requireApproval ?? AUTONOMY_CONFIG.requireApproval;

  const enabled = Boolean(overrides?.enabled) && isAutonomyEnvUnlocked();

  return {
    enabled,
    mode,
    maxEmailsPerDay: maxEmails,
    maxActionsPerRun: maxActions,
    requireApproval,
  };
}

import "server-only";

import type { AutonomyMode } from "./types";

export type AutonomyAllow = {
  observe: boolean;
  update_copy: boolean;
  adjust_sequence: boolean;
  retry_jobs: boolean;
  budget_change: boolean;
  db_changes: boolean;
};

export type AutonomyConfigResolved = {
  enabled: boolean;
  mode: AutonomyMode;
  limits: { maxActionsPerRun: number };
  allow: AutonomyAllow;
  /** Where enabled/mode came from. */
  source: "env" | "override" | "merged";
};

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function envMode(): AutonomyMode {
  const m = String(process.env.AUTONOMY_MODE ?? "").trim().toLowerCase();
  if (m === "semi" || m === "auto" || m === "dry-run") return m;
  return "dry-run";
}

function envInt(name: string, min: number, max: number, fallback: number): number {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

/** Env-only baseline (kill switch default off). */
export function getAutonomyEnvConfig(): Omit<AutonomyConfigResolved, "source"> {
  return {
    enabled: envBool("AUTONOMY_ENABLED", false),
    mode: envMode(),
    limits: {
      maxActionsPerRun: envInt("AUTONOMY_MAX_ACTIONS", 1, 20, 5),
    },
    allow: {
      observe: envBool("AUTONOMY_ALLOW_OBSERVE", true),
      update_copy: envBool("AUTONOMY_ALLOW_UPDATE_COPY", true),
      adjust_sequence: envBool("AUTONOMY_ALLOW_ADJUST_SEQUENCE", true),
      retry_jobs: envBool("AUTONOMY_ALLOW_RETRY_JOBS", true),
      budget_change: envBool("AUTONOMY_ALLOW_BUDGET_CHANGE", false),
      db_changes: envBool("AUTONOMY_ALLOW_DB_CHANGES", false),
    },
  };
}

/**
 * Static export for docs/tests; runtime must use merge with override from DB.
 * @deprecated Prefer getAutonomyEnvConfig + mergeAutonomyOverride
 */
export const AUTONOMY = {
  get enabled() {
    return getAutonomyEnvConfig().enabled;
  },
  get mode() {
    return getAutonomyEnvConfig().mode;
  },
  get limits() {
    return getAutonomyEnvConfig().limits;
  },
  get allow() {
    return getAutonomyEnvConfig().allow;
  },
};

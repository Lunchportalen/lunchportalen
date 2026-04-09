import "server-only";

export type SelfHealMode = "dry-run" | "semi" | "auto";

export type SelfHealAllow = {
  restart_jobs: boolean;
  retry_outbox: boolean;
  clear_locks: boolean;
  rebuild_cache: boolean;
  scale_workers: boolean;
  db_migration: boolean;
  notify_human: boolean;
};

export type SelfHealConfig = {
  enabled: boolean;
  mode: SelfHealMode;
  allow: SelfHealAllow;
  maxActionsPerRun: number;
  cooldownMinutes: number;
};

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function envInt(name: string, min: number, max: number, fallback: number): number {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function envMode(): SelfHealMode {
  const m = String(process.env.SELF_HEAL_MODE ?? "").trim().toLowerCase();
  if (m === "semi" || m === "auto" || m === "dry-run") return m;
  return "dry-run";
}

/** Reads env at call time (policy overrides). */
export function getSelfHealConfig(): SelfHealConfig {
  return {
    enabled: envBool("SELF_HEAL_ENABLED", false),
    mode: envMode(),
    allow: {
      restart_jobs: envBool("SELF_HEAL_ALLOW_RESTART_JOBS", true),
      retry_outbox: envBool("SELF_HEAL_ALLOW_RETRY_OUTBOX", true),
      clear_locks: envBool("SELF_HEAL_ALLOW_CLEAR_LOCKS", true),
      rebuild_cache: envBool("SELF_HEAL_ALLOW_REBUILD_CACHE", true),
      scale_workers: envBool("SELF_HEAL_ALLOW_SCALE_WORKERS", false),
      db_migration: envBool("SELF_HEAL_ALLOW_DB_MIGRATION", false),
      notify_human: envBool("SELF_HEAL_ALLOW_NOTIFY_HUMAN", true),
    },
    maxActionsPerRun: envInt("SELF_HEAL_MAX_ACTIONS", 1, 20, 5),
    cooldownMinutes: envInt("SELF_HEAL_COOLDOWN_MINUTES", 1, 1440, 10),
  };
}

/**
 * Global kill switch + modes (default: off, dry-run).
 * Prefer `getSelfHealConfig()` in code paths so policy is explicit.
 */
export const SELF_HEAL_CONFIG = {
  get enabled() {
    return getSelfHealConfig().enabled;
  },
  get mode() {
    return getSelfHealConfig().mode;
  },
  get allow() {
    return getSelfHealConfig().allow;
  },
  get maxActionsPerRun() {
    return getSelfHealConfig().maxActionsPerRun;
  },
  get cooldownMinutes() {
    return getSelfHealConfig().cooldownMinutes;
  },
};

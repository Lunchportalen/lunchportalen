import "server-only";

/**
 * Revenue closed-loop guardrails (env-driven kill switch + blast limits).
 * Decisions are deterministic code — never AI.
 */

export type RevenueGuardrailsMode = "dry-run" | "semi" | "auto";

export type RevenueGuardrails = {
  enabled: boolean;
  mode: RevenueGuardrailsMode;
  maxExperimentsPerRun: number;
  /** Cap for deterministic routing math (two-arm test = max 0.5 per arm). */
  maxTrafficSplit: number;
  cooldownHours: number;
  allowedActions: {
    update_copy: boolean;
    adjust_sequence: boolean;
  };
  /** Optional auto-promote of winning variant (planned posts only). */
  autoPromote: boolean;
};

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function envMode(): RevenueGuardrailsMode {
  const m = String(process.env.REVENUE_AUTOPILOT_MODE ?? "").trim().toLowerCase();
  if (m === "semi" || m === "auto" || m === "dry-run") return m;
  return "dry-run";
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function envInt(name: string, min: number, max: number, fallback: number): number {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.floor(n), min, max);
}

export function getRevenueGuardrails(): RevenueGuardrails {
  return {
    enabled: envBool("REVENUE_AUTOPILOT_ENABLED", false),
    mode: envMode(),
    maxExperimentsPerRun: envInt("REVENUE_AUTOPILOT_MAX_EXPERIMENTS_PER_RUN", 1, 5, 2),
    maxTrafficSplit: (() => {
      const n = Number(process.env.REVENUE_AUTOPILOT_MAX_TRAFFIC_SPLIT);
      if (!Number.isFinite(n)) return 0.5;
      return clamp(n, 0.1, 0.5);
    })(),
    cooldownHours: envInt("REVENUE_AUTOPILOT_COOLDOWN_HOURS", 1, 168, 24),
    allowedActions: {
      update_copy: envBool("REVENUE_AUTOPILOT_ALLOW_UPDATE_COPY", true),
      adjust_sequence: envBool("REVENUE_AUTOPILOT_ALLOW_ADJUST_SEQUENCE", false),
    },
    autoPromote: envBool("REVENUE_AUTOPILOT_AUTO_PROMOTE", false),
  };
}

export function allowRevenueAction(type: keyof RevenueGuardrails["allowedActions"]): boolean {
  const g = getRevenueGuardrails();
  return g.enabled === true && g.allowedActions[type] === true;
}

/**
 * Live view of guardrails (env: `REVENUE_AUTOPILOT_*`). Same values as `getRevenueGuardrails()` —
 * not a frozen snapshot; reads current env each access.
 */
export const GUARDRAILS = {
  get enabled() {
    return getRevenueGuardrails().enabled;
  },
  get mode() {
    return getRevenueGuardrails().mode;
  },
  get maxExperimentsPerRun() {
    return getRevenueGuardrails().maxExperimentsPerRun;
  },
  get maxTrafficSplit() {
    return getRevenueGuardrails().maxTrafficSplit;
  },
  get cooldownHours() {
    return getRevenueGuardrails().cooldownHours;
  },
  get allowedActions() {
    return getRevenueGuardrails().allowedActions;
  },
  get autoPromote() {
    return getRevenueGuardrails().autoPromote;
  },
};

/** Spec alias — decisions stay in code; this only gates execution. */
export function allowAction(type: keyof RevenueGuardrails["allowedActions"]): boolean {
  return allowRevenueAction(type);
}

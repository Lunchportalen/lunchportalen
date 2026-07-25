/**
 * Business-realistic Phase 18SCALE load model.
 * Separates Auth/session coverage from logical operation capacity.
 */
export const AUTH_USERS_TARGET = 100_000;
export const COMPANIES_TARGET = 2_000;
export const PROVIDERS_TARGET = 1_000;

/** Active load pool for business HTTP (not 100k concurrent Auth). */
export const ACTIVE_LOAD_SESSIONS_MIN = 2_000;
export const ACTIVE_LOAD_SESSIONS_TARGET = 5_000;

/** Representative Auth refresh proof (one session per company × 2 cycles). */
export const AUTH_REFRESH_COVERAGE_SESSIONS = 2_000;
export const AUTH_REFRESH_CYCLES = 2;
export const AUTH_CONCURRENT_CANARY = 500;

/** Controlled logical-op ramps (session reuse allowed). */
export const LOGICAL_RAMP_TARGETS = Object.freeze([100, 500, 1_000, 5_000, 10_000]);

export const MAX_ORDER_OPS_PER_SESSION_100K = 20;
export const MAX_CANCEL_OPS_PER_SESSION_50K = 10;
export const MAX_ORDER_OPS_PER_SESSION_RAMP_10K = 2;

export function maxOpsPerSessionForWave(waveTarget, poolSize = ACTIVE_LOAD_SESSIONS_TARGET) {
  if (!poolSize) throw new Error("PHASE18_POOL_SIZE_REQUIRED");
  return Math.ceil(Number(waveTarget) / Number(poolSize));
}

export function resolveLogicalRampStage(env = process.env) {
  const explicit = String(env.PHASE18_LOGICAL_RAMP || "").trim();
  if (explicit && LOGICAL_RAMP_TARGETS.includes(Number(explicit))) return Number(explicit);
  const wave = Number(env.PHASE18_HTTP_WAVE || 0);
  if (LOGICAL_RAMP_TARGETS.includes(wave)) return wave;
  return null;
}

export function sessionReuseAllowed(env = process.env) {
  return ["1", "true", "yes"].includes(String(env.PHASE18_LOGICAL_OPS_MODE || "").toLowerCase());
}

export function certificationStatusDefaults() {
  return {
    GLOBAL_MENU_UNIVERSES_TECHNICAL_PASS: "YES",
    LOCAL_CORRECTNESS_CERTIFIED: "YES",
    GLOBAL_SCALE_CERTIFIED: "NO",
    AUTH_SESSION_COVERAGE_CERTIFIED: "NO",
    BUSINESS_OPERATION_SCALE_CERTIFIED: "NO",
    CUTOFF_FREEZE_CERTIFIED: "NO",
    FINANCIAL_LOAD_RECONCILIATION_CERTIFIED: "NO",
    CLOUD_RAMPS_COMPLETE: "NO",
    PRODUCTION_DEPLOYMENT: "NOT APPROVED",
    CONCURRENT_100K_UNIQUE_AUTH_SESSIONS_CERTIFIED: "NO",
  };
}

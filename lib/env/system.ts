// lib/env/system.ts
// Minimal env validator for system runtime checks (Phase 1/2 health).
// Never throws. No side effects. No secrets printed.
// Callers (e.g. GET /api/health) must fail closed on ok: false (e.g. 503).

export type SystemRuntimeEnvReport = { ok: true } | { ok: false; missing: string[]; invalid?: string[] };

/** Canonical list of required env for system motor / public health. Add only for verified critical runtime. */
export const REQUIRED_SYSTEM_RUNTIME_KEYS: readonly string[] = ["SYSTEM_MOTOR_SECRET"];

function isPresent(v: unknown): boolean {
  return typeof v === "string" ? v.trim().length > 0 : Boolean(v);
}

/**
 * Validates that all REQUIRED_SYSTEM_RUNTIME_KEYS are present and non-empty.
 * Does not throw; returns report. No silent fallback: missing keys → ok: false, missing[].
 */
export function validateSystemRuntimeEnv(): SystemRuntimeEnvReport {
  const missing = [...REQUIRED_SYSTEM_RUNTIME_KEYS].filter((k) => !isPresent(process.env[k]));
  if (missing.length) return { ok: false, missing };
  return { ok: true };
}

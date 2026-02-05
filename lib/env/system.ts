// lib/env/system.ts
// Minimal env validator for system runtime checks (Phase 1/2 health).
// Never throws. No side effects. No secrets printed.

export type SystemRuntimeEnvReport = { ok: true } | { ok: false; missing: string[]; invalid?: string[] };

const REQUIRED_SYSTEM_RUNTIME_KEYS = ["SYSTEM_MOTOR_SECRET"] as const;

function isPresent(v: any): boolean {
  return typeof v === "string" ? v.trim().length > 0 : Boolean(v);
}

/**
 * Canonical required env vars for the system motor/runtime.
 * Add more ONLY if a runtime feature truly depends on them.
 */
export function validateSystemRuntimeEnv(): SystemRuntimeEnvReport {
  const missing = REQUIRED_SYSTEM_RUNTIME_KEYS.filter((k) => !isPresent(process.env[k]));
  if (missing.length) return { ok: false, missing };
  return { ok: true };
}

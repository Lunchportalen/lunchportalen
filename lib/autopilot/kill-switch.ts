/**
 * Autopilot kill-switch: env-first (survives cold starts), optional test override.
 */

let runtimeOverride: boolean | null = null;

export function isAutopilotEnabled(): boolean {
  if (runtimeOverride !== null) return runtimeOverride;
  return String(process.env.LP_AUTOPILOT_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

/** Read-only snapshot for superadmin UI (env + optional process-local override). */
export function getAutopilotKillSwitchState(): {
  envAllows: boolean;
  runtimeOverride: boolean | null;
  effectiveEnabled: boolean;
} {
  const envAllows = String(process.env.LP_AUTOPILOT_ENABLED ?? "true").trim().toLowerCase() !== "false";
  return {
    envAllows,
    runtimeOverride,
    effectiveEnabled: isAutopilotEnabled(),
  };
}

/** Test-only: prefer `LP_AUTOPILOT_ENABLED=false` in env for production. */
export function disableAutopilot(): void {
  runtimeOverride = false;
}

export function enableAutopilot(): void {
  runtimeOverride = true;
}

export function clearAutopilotRuntimeOverride(): void {
  runtimeOverride = null;
}

/**
 * Process-local scale mode flags (superadmin control tower). Env: LP_SCALE_MODE_ENABLED (default på).
 * Ikke persistert som database — reversibel via resume/enable eller env.
 */
import "server-only";

let runtimeEnabledOverride: boolean | null = null;
let paused = false;
let manualOverride = false;

export function getScaleModeEnvAllows(): boolean {
  return String(process.env.LP_SCALE_MODE_ENABLED ?? "true").trim().toLowerCase() !== "false";
}

export function getScaleModeState(): {
  envAllows: boolean;
  runtimeOverride: boolean | null;
  paused: boolean;
  manualOverride: boolean;
  /** Effektivt «på» når env tillater, runtime ikke av, og ikke pauset. */
  effectiveActive: boolean;
} {
  const envAllows = getScaleModeEnvAllows();
  const enabled =
    runtimeEnabledOverride !== null ? runtimeEnabledOverride : envAllows;
  const effectiveActive = enabled && !paused;
  return {
    envAllows,
    runtimeOverride: runtimeEnabledOverride,
    paused,
    manualOverride,
    effectiveActive,
  };
}

export function enableScaleModeRuntime(): void {
  runtimeEnabledOverride = true;
}

export function disableScaleModeRuntime(): void {
  runtimeEnabledOverride = false;
}

export function clearScaleModeRuntimeOverride(): void {
  runtimeEnabledOverride = null;
}

export function pauseScaleMode(): void {
  paused = true;
}

export function resumeScaleMode(): void {
  paused = false;
}

export function setScaleManualOverride(value: boolean): void {
  manualOverride = Boolean(value);
}

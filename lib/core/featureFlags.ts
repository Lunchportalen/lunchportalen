/**
 * Kill-switches for automation — unset env = enabled (no silent behaviour change for existing deploys).
 * Set to "0" or "false" to disable.
 */

function envDisabled(name: string): boolean {
  const v = process.env[name];
  if (v == null || v === "") return false;
  const x = v.trim().toLowerCase();
  return x === "0" || x === "false" || x === "off" || x === "no";
}

/** Master AI / LLM-backed routes and helpers (opt-out). */
export function isAiFeatureEnabled(): boolean {
  return !envDisabled("ENABLE_AI");
}

/** Auto-optimize / auto-apply paths (control tower auto, unattended design apply). */
export function isAutoOptimizeEnabled(): boolean {
  return !envDisabled("ENABLE_AUTO_OPTIMIZE");
}

/** Pattern scale + controlled scale engine execution. */
export function isScaleAutomationEnabled(): boolean {
  return !envDisabled("ENABLE_SCALE");
}

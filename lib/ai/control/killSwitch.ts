/**
 * When AI_GLOBAL_KILL_SWITCH is `"true"`, all gated automation lanes stop (crons should short-circuit too).
 */

export function isSystemEnabled(): boolean {
  if (process.env.AI_GLOBAL_KILL_SWITCH === "true") {
    return false;
  }
  return true;
}

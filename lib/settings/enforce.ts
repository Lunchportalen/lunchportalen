import "server-only";

import type { SystemSettings } from "@/lib/system/settings";

/**
 * Server-side feature gate: toggle må være eksplisitt `true`.
 */
export function assertFeature(settings: SystemSettings | null | undefined, key: string): void {
  const k = String(key ?? "").trim();
  if (!k) throw new Error("FEATURE_KEY_MISSING");
  const t = settings?.toggles as Record<string, unknown> | undefined;
  if (t?.[k] !== true) {
    throw new Error(`FEATURE_DISABLED:${k}`);
  }
}

/**
 * Kill-switch må ikke være aktiv for gitt nøkkel (fail-closed).
 * Kaster Error med stabile koder som routesMapper allerede kjenner.
 */
export function assertNotKilled(settings: SystemSettings | null | undefined, key: string): void {
  const k = String(key ?? "").trim();
  if (!k) throw new Error("KILLSWITCH_KEY_MISSING");
  const ks = settings?.killswitch as Record<string, boolean | undefined> | undefined;
  if (ks?.[k] === true) {
    if (k === "orders") throw new Error("ORDERS_BLOCKED");
    if (k === "cancellations") throw new Error("CANCELLATIONS_BLOCKED");
    if (k === "global") throw new Error("SYSTEM_HALTED");
    throw new Error(`KILL_SWITCH:${k}`);
  }
}

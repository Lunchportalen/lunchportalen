// lib/system/opsKillSwitch.ts
// Global launch (Fase I): server-side kill switch gate for session-less surfaces
// (webhooks, cron). Reuses the existing system_settings.killswitch model —
// superadmin-owned via the system workspace; no client-side bypass possible.
import "server-only";

import type { KillSwitch } from "@/lib/system/settings";
import { getSystemSettings } from "@/lib/system/settings";
import { opsLog } from "@/lib/ops/log";

export type OpsKillKey = keyof KillSwitch;

export type OpsKillResult =
  | { killed: false }
  | { killed: true; key: OpsKillKey | "global" };

/**
 * Checks `global` plus the given killswitch keys. A switch blocks only when it is
 * explicitly `true` in persisted settings (same semantics as enforceSystemGate:
 * unreadable settings resolve to defaults = open, and the read is logged upstream).
 */
export async function checkOpsKillSwitch(...keys: OpsKillKey[]): Promise<OpsKillResult> {
  const settings = await getSystemSettings();
  const ks = settings.killswitch as Record<string, boolean | undefined>;

  if (ks.global === true) return { killed: true, key: "global" };
  for (const key of keys) {
    if (ks[key] === true) return { killed: true, key };
  }
  return { killed: false };
}

/**
 * Route helper: returns a 503 JSON response when killed (retryable for Stripe/cron),
 * otherwise null. Logs the block for audit/observability.
 */
export async function opsKillSwitchResponse(
  rid: string,
  ...keys: OpsKillKey[]
): Promise<Response | null> {
  const result = await checkOpsKillSwitch(...keys);
  if (!result.killed) return null;

  try {
    opsLog("killswitch", {
      rid,
      kind: "OPS_KILL_SWITCH_BLOCKED",
      key: result.key,
      keys,
    });
  } catch {
    // best effort
  }

  return new Response(
    JSON.stringify({
      ok: false,
      rid,
      error: "KILL_SWITCH",
      message: `Funksjonen er midlertidig stoppet (${result.key}).`,
      status: 503,
    }),
    {
      status: 503,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        // Ask Stripe/schedulers to retry later.
        "retry-after": "300",
      },
    },
  );
}

// STATUS: KEEP

// lib/system/enforcement.ts
import "server-only";
import { getCachedSettings } from "@/lib/settings/cache";
import { assertNotKilled } from "@/lib/settings/enforce";
import { supabaseServer } from "@/lib/supabase/server";
import { assertSystemAlive } from "@/lib/system/kill";
import { getSystemSettings, type SystemSettings } from "@/lib/system/settings";

async function loadSettingsForGate(): Promise<SystemSettings> {
  const sb = await supabaseServer();
  const cached = await getCachedSettings(sb);
  if (cached) return cached;
  try {
    return await getSystemSettings();
  } catch {
    throw new Error("SETTINGS_UNAVAILABLE");
  }
}

export async function enforceSystemGate(opts: {
  action: "ORDER_CREATE" | "ORDER_CANCEL";
  strictOverride?: boolean;
}) {
  const s = await loadSettingsForGate();

  assertSystemAlive(s);

  if (opts.action === "ORDER_CREATE") {
    assertNotKilled(s, "orders");
  }
  if (opts.action === "ORDER_CANCEL") {
    assertNotKilled(s, "cancellations");
  }

  // Strict mode (no exceptions)
  if (s.toggles.strict_mode && !opts.strictOverride) {
    // alt må gå via systemets regler
    return;
  }
}

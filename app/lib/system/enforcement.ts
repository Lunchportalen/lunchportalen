// lib/system/enforcement.ts
import "server-only";
import { getSystemSettings } from "@/lib/system/settings";

export async function enforceSystemGate(opts: {
  action: "ORDER_CREATE" | "ORDER_CANCEL";
  strictOverride?: boolean;
}) {
  const s = await getSystemSettings();

  // Kill switches
  if (opts.action === "ORDER_CREATE" && s.killswitch.orders) {
    throw new Error("ORDERS_BLOCKED");
  }
  if (opts.action === "ORDER_CANCEL" && s.killswitch.cancellations) {
    throw new Error("CANCELLATIONS_BLOCKED");
  }

  // Strict mode (no exceptions)
  if (s.toggles.strict_mode && !opts.strictOverride) {
    // alt må gå via systemets regler
    return;
  }
}

import type { AnyAutonomyAction } from "@/lib/autonomy/growthTypes";
import type { SystemSettings } from "@/lib/system/settings";

export function isAllowed(settings: SystemSettings | null, action: AnyAutonomyAction): boolean {
  if (!settings?.toggles?.autonomy_master_enabled) return false;

  if (settings.killswitch?.global === true) return false;

  if (action.type === "price_drop" || action.type === "pricing_adjustment") {
    return Boolean(settings.toggles.autonomy_allow_auto_pricing);
  }

  if (action.type === "activate_ads") {
    return Boolean(settings.toggles.autonomy_allow_auto_ads);
  }

  return false;
}

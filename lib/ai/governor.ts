import "server-only";

import type { SystemSettings } from "@/lib/system/settings";

/**
 * Server-side AI policy før LLM-kall. Fail-closed.
 */
export function enforceAIPolicy(settings: SystemSettings | null, action: { type?: string }): void {
  if (!settings) {
    throw {
      code: "SETTINGS_UNAVAILABLE",
      message: "Systeminnstillinger er ikke tilgjengelige",
      source: "ai",
      severity: "high" as const,
    };
  }

  if (settings.toggles.ai_enabled === false) {
    throw {
      code: "AI_DISABLED",
      message: "AI er deaktivert i systeminnstillinger",
      source: "ai",
      severity: "high" as const,
    };
  }

  if (settings.killswitch.ai === true) {
    throw {
      code: "AI_KILLED",
      message: "AI killswitch er aktiv",
      source: "ai",
      severity: "high" as const,
    };
  }

  const t = typeof action?.type === "string" ? action.type.trim() : "";
  if (!t) {
    throw {
      code: "AI_INVALID_ACTION",
      message: "Mangler handlingstype",
      source: "ai",
      severity: "high" as const,
    };
  }
}

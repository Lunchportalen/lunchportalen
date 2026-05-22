import type { DashboardActivityEvent } from "@/app/leverandor/innstillinger/tripletex/status/actions";

export type ActivityIconKind = "success" | "warn" | "error" | "neutral";

export function activityIconKind(
  action: string,
  metadata?: DashboardActivityEvent["metadata"],
): ActivityIconKind {
  const key = String(action ?? "").trim();

  if (
    key === "tripletex_onboarding_disconnected" ||
    key === "tripletex_onboarding_vault_purged" ||
    metadata?.new_state === "DISCONNECTED" ||
    metadata?.new_state === "DEGRADED"
  ) {
    return key.includes("disconnected") || key.includes("vault_purged") ? "error" : "warn";
  }

  if (key === "tripletex_onboarding_customer_skipped") return "warn";

  if (
    key === "tripletex_onboarding_finalized" ||
    key === "tripletex_onboarding_provisioning_completed" ||
    key === "tripletex_onboarding_connection_started" ||
    key === "tripletex_onboarding_test_token" ||
    metadata?.new_state === "CONNECTED"
  ) {
    return "success";
  }

  return "neutral";
}

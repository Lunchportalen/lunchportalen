/**
 * Phase C — classify read-only locale inventory into launch gates.
 */

import type {
  PhaseCLocaleClassification,
  PhaseCLocaleInventoryRow,
} from "@/lib/provider-onboarding/providerOnboardingTypes";

export type PhaseCLocaleInventoryInput = Omit<
  PhaseCLocaleInventoryRow,
  "classification" | "blockers" | "canDryRunToday" | "canApplyAfterGo"
>;

function settingsAndMirrorReady(row: PhaseCLocaleInventoryInput): boolean {
  return (
    row.providerExists &&
    row.organizationMirrorExists &&
    row.providerSettingsComplete &&
    row.providerAdminAuthExists &&
    row.providerMembershipExists &&
    row.sanityProviderMirrorExists &&
    row.providerRefResolves &&
    row.globalSanityTemplatesOk
  );
}

export function classifyPhaseCLocaleInventory(
  row: PhaseCLocaleInventoryInput,
): Pick<
  PhaseCLocaleInventoryRow,
  "classification" | "blockers" | "canDryRunToday" | "canApplyAfterGo"
> {
  const blockers: string[] = [];
  let classification: PhaseCLocaleClassification = "BLOCKED_UNKNOWN";

  if (!row.globalSanityTemplatesOk) {
    blockers.push("BLOCKED_GLOBAL_TEMPLATE");
    classification = "BLOCKED_GLOBAL_TEMPLATE";
  } else if (!row.providerExists) {
    blockers.push("BLOCKED_PROVIDER");
    classification = "BLOCKED_PROVIDER";
  } else if (!row.organizationMirrorExists) {
    blockers.push("BLOCKED_ORG_MIRROR");
    classification = "BLOCKED_ORG_MIRROR";
  } else if (!row.providerSettingsComplete) {
    blockers.push("BLOCKED_SETTINGS");
    classification = "BLOCKED_SETTINGS";
  } else if (!row.providerAdminAuthExists || !row.providerMembershipExists) {
    blockers.push("BLOCKED_AUTH");
    classification = "BLOCKED_AUTH";
  } else if (!row.sanityProviderMirrorExists || !row.providerRefResolves) {
    blockers.push("BLOCKED_SANITY_MIRROR");
    classification = "BLOCKED_SANITY_MIRROR";
  } else if (!row.automationCredsAvailable) {
    blockers.push("BLOCKED_CREDS");
    classification = "BLOCKED_CREDS";
  } else if (settingsAndMirrorReady(row)) {
    const hasEvidence = Boolean(row.latestApplyOrDryRunEvidence);
    classification = hasEvidence ? "READY_FOR_SCOPED_APPLY" : "READY_FOR_DRYRUN";
  } else {
    blockers.push("BLOCKED_UNKNOWN");
    classification = "BLOCKED_UNKNOWN";
  }

  const canDryRunToday =
    classification === "READY_FOR_DRYRUN" || classification === "READY_FOR_SCOPED_APPLY";
  const canApplyAfterGo = classification === "READY_FOR_SCOPED_APPLY";

  return { classification, blockers, canDryRunToday, canApplyAfterGo };
}

export function buildPhaseCLocaleInventoryRow(
  input: PhaseCLocaleInventoryInput,
): PhaseCLocaleInventoryRow {
  return {
    ...input,
    ...classifyPhaseCLocaleInventory(input),
  };
}

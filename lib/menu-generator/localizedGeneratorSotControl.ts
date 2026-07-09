/**
 * Gate F0 — Localized generator SOT runtime control (observe-only, fail-closed).
 * No order write-path, no materialization mutation, no employee payload serve change.
 */

import type { EnvLike } from "@/lib/menu-profile/featureFlag";
import {
  isLocalizedGeneratorSotDryRunEnabled,
  isLocalizedGeneratorSotEnabled,
  parseLocalizedGeneratorSotProviderAllowlist,
} from "@/lib/menu-generator/sotFeatureFlag";
import {
  resolveLocalizedGeneratorSotDecision,
  toLocalizedGeneratorSotOpsLogPayload,
  type LocalizedGeneratorSotDecision,
} from "@/lib/menu-generator/localizedGeneratorSotResolver";

export type LocalizedGeneratorSotControlStatus =
  | "inactive"
  | "dry_run"
  | "eligible_not_wired"
  | "blocked";

export type LocalizedGeneratorSotRuntimeControl = {
  phase: "F0";
  sotFlag: "ON" | "OFF";
  dryRunFlag: "ON" | "OFF";
  allowlistCount: number;
  active: boolean;
  status: LocalizedGeneratorSotControlStatus;
  selectedSource: "legacy";
  sourceOfTruthChanged: false;
  autoRollout: false;
  productionCutoverAllowed: false;
  messages: string[];
  decision: LocalizedGeneratorSotDecision | null;
};

const INACTIVE_MESSAGES = [
  "Localized generator SOT inactive — LP_LOCALIZED_GENERATOR_SOT_ENABLED is OFF",
  "Legacy runtime unchanged",
] as const;

function sotFlagLabel(env: EnvLike): "ON" | "OFF" {
  return isLocalizedGeneratorSotEnabled(env) ? "ON" : "OFF";
}

function dryRunFlagLabel(env: EnvLike): "ON" | "OFF" {
  return isLocalizedGeneratorSotDryRunEnabled(env) ? "ON" : "OFF";
}

export function buildLocalizedGeneratorSotInactiveControl(env: EnvLike = {}): LocalizedGeneratorSotRuntimeControl {
  return {
    phase: "F0",
    sotFlag: sotFlagLabel(env),
    dryRunFlag: dryRunFlagLabel(env),
    allowlistCount: parseLocalizedGeneratorSotProviderAllowlist(env).length,
    active: false,
    status: "inactive",
    selectedSource: "legacy",
    sourceOfTruthChanged: false,
    autoRollout: false,
    productionCutoverAllowed: false,
    messages: [...INACTIVE_MESSAGES],
    decision: null,
  };
}

export function buildLocalizedGeneratorSotProviderControl(
  env: EnvLike,
  providerId: string,
): LocalizedGeneratorSotRuntimeControl {
  if (!isLocalizedGeneratorSotEnabled(env)) {
    return buildLocalizedGeneratorSotInactiveControl(env);
  }

  const decision = resolveLocalizedGeneratorSotDecision({ providerId, env });
  const status: LocalizedGeneratorSotControlStatus = decision.dryRun
    ? "dry_run"
    : decision.sotEligible
      ? "eligible_not_wired"
      : "blocked";

  return {
    phase: "F0",
    sotFlag: "ON",
    dryRunFlag: decision.dryRun ? "ON" : "OFF",
    allowlistCount: parseLocalizedGeneratorSotProviderAllowlist(env).length,
    active: decision.sotEligible || decision.dryRun,
    status,
    selectedSource: "legacy",
    sourceOfTruthChanged: false,
    autoRollout: false,
    productionCutoverAllowed: false,
    messages: decision.messages,
    decision,
  };
}

export function toLocalizedGeneratorSotControlOpsLog(control: LocalizedGeneratorSotRuntimeControl) {
  return {
    phase: control.phase,
    sotFlag: control.sotFlag,
    dryRunFlag: control.dryRunFlag,
    allowlistCount: control.allowlistCount,
    active: control.active,
    status: control.status,
    selectedSource: control.selectedSource,
    sourceOfTruthChanged: control.sourceOfTruthChanged,
    autoRollout: control.autoRollout,
    productionCutoverAllowed: control.productionCutoverAllowed,
    decision: control.decision ? toLocalizedGeneratorSotOpsLogPayload(control.decision) : null,
  };
}

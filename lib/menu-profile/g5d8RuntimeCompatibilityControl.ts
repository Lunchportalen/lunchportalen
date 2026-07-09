/**
 * G5d.8 — Runtime compatibility hook governance (observe-only, fail-closed).
 * No order write-path, no SOT switch, no auto-rollout, no employee payload mutation.
 */

import "server-only";

import {
  isMenuProfileResolverEnabled,
  isMenuProfileRuntimeCompatibilityHookEnabled,
  type EnvLike,
} from "@/lib/menu-profile/featureFlag";
import type { WeekRuntimeCompatibilityDecision } from "@/lib/menu-profile/weekRuntimeCompatibilityResolver.server";

export type G5d8CompatibilityStatus = "inactive" | "observing" | "fail_closed" | "blocked";

export type G5d8StopConditionRisk = "none" | "watch" | "stop";

export type G5d8ProviderHealthSlice = {
  profileResolved: "OK" | "FAIL";
  fallbackActive: boolean;
  resolveSource: string | null;
  readiness: string;
  warning: string | null;
};

export type G5d8RuntimeCompatibilityControl = {
  phase: "G5d.8";
  hookFlag: "ON" | "OFF";
  active: boolean;
  resolverFlagOn: boolean;
  compatibilityStatus: G5d8CompatibilityStatus;
  selectedSource: "current";
  resolveSource: string | null;
  providerProfileStatus: "OK" | "FAIL" | "legacy" | null;
  fallbackActive: boolean | null;
  warnings: string[];
  stopConditionRisk: G5d8StopConditionRisk;
  sourceOfTruthChanged: false;
  autoRollout: false;
  candidateOrderable: false;
  productionActivationAllowed: false;
  messages: string[];
};

export type G5d8GlobalSummary = {
  resolverFlagOn: boolean;
  warningProviders: number;
  profileFailProviders: number;
};

const INACTIVE_MESSAGES = [
  "Compatibility hook inactive — LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK is OFF",
  "Employee runtime unchanged",
] as const;

function hookFlagLabel(env: EnvLike): "ON" | "OFF" {
  return isMenuProfileRuntimeCompatibilityHookEnabled(env) ? "ON" : "OFF";
}

function deriveStopConditionRisk(input: {
  hookActive: boolean;
  validationOk: boolean;
  profileFailProviders: number;
  warningProviders: number;
  fallbackActive: boolean | null;
}): G5d8StopConditionRisk {
  if (!input.hookActive) return "none";
  if (!input.validationOk || input.profileFailProviders > 0) return "stop";
  if (input.warningProviders > 0 || input.fallbackActive === true) return "watch";
  return "none";
}

function deriveCompatibilityStatus(input: {
  hookActive: boolean;
  validationOk: boolean;
  fallbackToCurrent: boolean;
}): G5d8CompatibilityStatus {
  if (!input.hookActive) return "inactive";
  if (!input.validationOk) return "blocked";
  if (input.fallbackToCurrent) return "fail_closed";
  return "observing";
}

export function buildG5d8InactiveControl(env: EnvLike = {}): G5d8RuntimeCompatibilityControl {
  return {
    phase: "G5d.8",
    hookFlag: hookFlagLabel(env),
    active: false,
    resolverFlagOn: isMenuProfileResolverEnabled(env),
    compatibilityStatus: "inactive",
    selectedSource: "current",
    resolveSource: null,
    providerProfileStatus: null,
    fallbackActive: null,
    warnings: [],
    stopConditionRisk: "none",
    sourceOfTruthChanged: false,
    autoRollout: false,
    candidateOrderable: false,
    productionActivationAllowed: false,
    messages: [...INACTIVE_MESSAGES],
  };
}

export function buildG5d8ControlFromWeekDecision(
  env: EnvLike,
  decision: WeekRuntimeCompatibilityDecision,
  providerHealth?: G5d8ProviderHealthSlice | null,
): G5d8RuntimeCompatibilityControl {
  if (!isMenuProfileRuntimeCompatibilityHookEnabled(env)) {
    return buildG5d8InactiveControl(env);
  }

  const warnings: string[] = [];
  if (!isMenuProfileResolverEnabled(env)) {
    warnings.push("Resolver OFF while compatibility hook ON — observe only, fail-closed to current runtime");
  }
  if (providerHealth?.fallbackActive) {
    warnings.push("Provider fallback active — compatibility observation only");
  }
  if (providerHealth?.warning) {
    warnings.push(providerHealth.warning);
  }
  if (!decision.validation.ok) {
    warnings.push("Compatibility input validation failed — fail-closed to current runtime");
  }

  const compatibilityStatus = deriveCompatibilityStatus({
    hookActive: true,
    validationOk: decision.validation.ok,
    fallbackToCurrent: decision.fallbackToCurrent,
  });

  const stopConditionRisk = deriveStopConditionRisk({
    hookActive: true,
    validationOk: decision.validation.ok,
    profileFailProviders: providerHealth?.profileResolved === "FAIL" ? 1 : 0,
    warningProviders: warnings.length,
    fallbackActive: providerHealth?.fallbackActive ?? null,
  });

  return {
    phase: "G5d.8",
    hookFlag: "ON",
    active: true,
    resolverFlagOn: isMenuProfileResolverEnabled(env),
    compatibilityStatus,
    selectedSource: "current",
    resolveSource: providerHealth?.resolveSource ?? null,
    providerProfileStatus:
      providerHealth?.profileResolved ??
      (providerHealth?.readiness === "legacy" ? "legacy" : null),
    fallbackActive: providerHealth?.fallbackActive ?? null,
    warnings,
    stopConditionRisk,
    sourceOfTruthChanged: false,
    autoRollout: false,
    candidateOrderable: false,
    productionActivationAllowed: false,
    messages: [
      "G5d.8 compatibility hook observing runtime — employee output remains current assembly",
      decision.fallbackToCurrent
        ? "Fail-closed to current runtime output"
        : "Compatibility evaluation blocked",
      "No source-of-truth switch",
      "No auto-rollout",
    ],
  };
}

export function buildG5d8ProviderControl(
  env: EnvLike,
  health: G5d8ProviderHealthSlice,
): G5d8RuntimeCompatibilityControl {
  if (!isMenuProfileRuntimeCompatibilityHookEnabled(env)) {
    const inactive = buildG5d8InactiveControl(env);
    const warnings = health.warning ? [health.warning] : [];
    return {
      ...inactive,
      resolveSource: health.resolveSource,
      providerProfileStatus: health.profileResolved,
      fallbackActive: health.fallbackActive,
      warnings,
      stopConditionRisk:
        health.profileResolved === "FAIL" ? "watch" : warnings.length > 0 ? "watch" : "none",
    };
  }

  const warnings: string[] = [];
  if (!isMenuProfileResolverEnabled(env)) {
    warnings.push("Resolver OFF while compatibility hook ON — observe only, fail-closed to current runtime");
  }
  if (health.fallbackActive) {
    warnings.push("Provider fallback active — compatibility observation only");
  }
  if (health.warning) {
    warnings.push(health.warning);
  }
  if (health.profileResolved === "FAIL") {
    warnings.push("Provider profile unresolved — stop-condition risk");
  }

  const stopConditionRisk = deriveStopConditionRisk({
    hookActive: true,
    validationOk: true,
    profileFailProviders: health.profileResolved === "FAIL" ? 1 : 0,
    warningProviders: warnings.length,
    fallbackActive: health.fallbackActive,
  });

  return {
    phase: "G5d.8",
    hookFlag: "ON",
    active: true,
    resolverFlagOn: isMenuProfileResolverEnabled(env),
    compatibilityStatus: stopConditionRisk === "stop" ? "blocked" : "fail_closed",
    selectedSource: "current",
    resolveSource: health.resolveSource,
    providerProfileStatus: health.profileResolved,
    fallbackActive: health.fallbackActive,
    warnings,
    stopConditionRisk,
    sourceOfTruthChanged: false,
    autoRollout: false,
    candidateOrderable: false,
    productionActivationAllowed: false,
    messages: [
      "G5d.8 provider compatibility observation — no employee payload mutation",
      "Fail-closed to current runtime output",
    ],
  };
}

export function buildG5d8GlobalControl(
  env: EnvLike,
  summary: G5d8GlobalSummary,
): G5d8RuntimeCompatibilityControl {
  if (!isMenuProfileRuntimeCompatibilityHookEnabled(env)) {
    const inactive = buildG5d8InactiveControl(env);
    if (summary.profileFailProviders > 0) {
      return {
        ...inactive,
        warnings: [`${summary.profileFailProviders} leverandør(er) med profil FAIL`],
        stopConditionRisk: "watch",
      };
    }
    if (summary.warningProviders > 0) {
      return {
        ...inactive,
        warnings: [`${summary.warningProviders} leverandør(er) med advarsler`],
        stopConditionRisk: "watch",
      };
    }
    return inactive;
  }

  const warnings: string[] = [];
  if (summary.profileFailProviders > 0) {
    warnings.push(`${summary.profileFailProviders} leverandør(er) med profil FAIL`);
  }
  if (summary.warningProviders > 0) {
    warnings.push(`${summary.warningProviders} leverandør(er) med advarsler`);
  }
  if (!summary.resolverFlagOn) {
    warnings.push("Resolver OFF — hook can observe only, must fail-closed");
  }

  const stopConditionRisk = deriveStopConditionRisk({
    hookActive: true,
    validationOk: true,
    profileFailProviders: summary.profileFailProviders,
    warningProviders: summary.warningProviders,
    fallbackActive: null,
  });

  return {
    phase: "G5d.8",
    hookFlag: "ON",
    active: true,
    resolverFlagOn: summary.resolverFlagOn,
    compatibilityStatus: stopConditionRisk === "stop" ? "blocked" : "observing",
    selectedSource: "current",
    resolveSource: null,
    providerProfileStatus: null,
    fallbackActive: null,
    warnings,
    stopConditionRisk,
    sourceOfTruthChanged: false,
    autoRollout: false,
    candidateOrderable: false,
    productionActivationAllowed: false,
    messages: [
      "G5d.8 compatibility hook active in this environment",
      "Employee order identity and payloads remain on current runtime assembly",
      "Production activation requires separate owner GO",
    ],
  };
}

export function toG5d8OpsLogPayload(control: G5d8RuntimeCompatibilityControl) {
  return {
    phase: control.phase,
    hookFlag: control.hookFlag,
    active: control.active,
    compatibilityStatus: control.compatibilityStatus,
    selectedSource: control.selectedSource,
    stopConditionRisk: control.stopConditionRisk,
    sourceOfTruthChanged: control.sourceOfTruthChanged,
    autoRollout: control.autoRollout,
    candidateOrderable: control.candidateOrderable,
    warningCount: control.warnings.length,
  };
}

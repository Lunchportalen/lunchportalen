/**
 * G5d.7c / G5d.8 — /week runtime compatibility hook boundary (server-only).
 * Calls pure adapter when flag ON; never mutates employee `/week` response.
 */

import "server-only";

import {
  buildG5d8ControlFromWeekDecision,
  toG5d8OpsLogPayload,
} from "@/lib/menu-profile/g5d8RuntimeCompatibilityControl";
import { opsLog } from "@/lib/ops/log";
import {
  isMenuProfileRuntimeCompatibilityHookEnabled,
  type EnvLike,
} from "@/lib/menu-profile/featureFlag";
import { buildWeekRuntimeCompatibilityDecision } from "@/lib/menu-profile/weekRuntimeCompatibilityResolver.server";

/** Explicit server-side hook boundary allowed by G5d.7c / G5d.8 governance. */
export const G5D7C_WEEK_HOOK_BOUNDARY_PATH = "app/api/week/route.ts";

export function maybeRunWeekRuntimeCompatibilityHook(args: {
  currentDays: unknown;
  rid: string;
  env: EnvLike;
}): void {
  if (!isMenuProfileRuntimeCompatibilityHookEnabled(args.env)) {
    return;
  }

  const decision = buildWeekRuntimeCompatibilityDecision({
    current: args.currentDays,
    candidate: { hookPhase: "G5d.8", opaqueCandidate: true },
    context: { boundary: G5D7C_WEEK_HOOK_BOUNDARY_PATH },
    flags: { runtimeHookActive: true },
  });

  const control = buildG5d8ControlFromWeekDecision(args.env, decision);

  if (decision.selectedSource !== "current" || decision.fallbackToCurrent !== true) {
    opsLog("week.runtimeCompatibilityHook.fail_closed", {
      rid: args.rid,
      boundary: G5D7C_WEEK_HOOK_BOUNDARY_PATH,
      reason: "adapter_must_select_current",
      ...toG5d8OpsLogPayload(control),
    });
    return;
  }

  opsLog("week.runtimeCompatibilityHook", {
    rid: args.rid,
    boundary: G5D7C_WEEK_HOOK_BOUNDARY_PATH,
    selectedSource: decision.selectedSource,
    fallbackToCurrent: decision.fallbackToCurrent,
    validationOk: decision.validation.ok,
    valuesEqual: decision.safeSummary.valuesEqual,
    runtimeHookActive: false,
    sourceOfTruthChanged: false,
    candidateOrderable: false,
    ...toG5d8OpsLogPayload(control),
  });
}

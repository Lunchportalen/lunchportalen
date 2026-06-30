/**
 * G5d.7c — Preview-only /week runtime compatibility hook boundary (server-only).
 * Calls pure adapter when flag ON; never mutates employee `/week` response.
 */

import "server-only";

import { opsLog } from "@/lib/ops/log";
import {
  isMenuProfileRuntimeCompatibilityHookEnabled,
  type EnvLike,
} from "@/lib/menu-profile/featureFlag";
import { buildWeekRuntimeCompatibilityDecision } from "@/lib/menu-profile/weekRuntimeCompatibilityResolver.server";

/** Explicit server-side hook boundary allowed by G5d.7c governance. */
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
    candidate: { hookPhase: "G5d.7c", opaqueCandidate: true },
    context: { boundary: G5D7C_WEEK_HOOK_BOUNDARY_PATH },
  });

  if (decision.selectedSource !== "current" || decision.fallbackToCurrent !== true) {
    opsLog("week.runtimeCompatibilityHook.fail_closed", {
      rid: args.rid,
      boundary: G5D7C_WEEK_HOOK_BOUNDARY_PATH,
      reason: "adapter_must_select_current",
    });
    return;
  }

  opsLog("week.runtimeCompatibilityHook", {
    rid: args.rid,
    boundary: G5D7C_WEEK_HOOK_BOUNDARY_PATH,
    phase: "G5d.7c",
    selectedSource: decision.selectedSource,
    fallbackToCurrent: decision.fallbackToCurrent,
    validationOk: decision.validation.ok,
    valuesEqual: decision.safeSummary.valuesEqual,
    runtimeHookActive: false,
    sourceOfTruthChanged: false,
    candidateOrderable: false,
  });
}

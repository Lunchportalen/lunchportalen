import { describe, expect, it } from "vitest";

import {
  LP_MENU_PROFILE_RESOLVER_ENV,
  LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV,
} from "@/lib/menu-profile/featureFlag";
import {
  buildG5d8ControlFromWeekDecision,
  buildG5d8GlobalControl,
  buildG5d8InactiveControl,
  buildG5d8ProviderControl,
} from "@/lib/menu-profile/g5d8RuntimeCompatibilityControl";
import { buildWeekRuntimeCompatibilityDecision } from "@/lib/menu-profile/weekRuntimeCompatibilityResolver.server";

const ENV_RESOLVER_ON = { [LP_MENU_PROFILE_RESOLVER_ENV]: "true" };
const ENV_HOOK_ON = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV]: "true",
};

describe("G5d.8 — inactive control when hook OFF", () => {
  it("returns inactive status without mutating runtime contracts", () => {
    const control = buildG5d8InactiveControl(ENV_RESOLVER_ON);
    expect(control.hookFlag).toBe("OFF");
    expect(control.active).toBe(false);
    expect(control.compatibilityStatus).toBe("inactive");
    expect(control.selectedSource).toBe("current");
    expect(control.sourceOfTruthChanged).toBe(false);
    expect(control.autoRollout).toBe(false);
    expect(control.candidateOrderable).toBe(false);
    expect(control.productionActivationAllowed).toBe(false);
  });
});

describe("G5d.8 — global control", () => {
  it("observes when hook ON and providers healthy", () => {
    const control = buildG5d8GlobalControl(ENV_HOOK_ON, {
      resolverFlagOn: true,
      warningProviders: 0,
      profileFailProviders: 0,
    });
    expect(control.active).toBe(true);
    expect(control.compatibilityStatus).toBe("observing");
    expect(control.stopConditionRisk).toBe("none");
  });

  it("raises stop risk when profile FAIL providers exist", () => {
    const control = buildG5d8GlobalControl(ENV_HOOK_ON, {
      resolverFlagOn: true,
      warningProviders: 0,
      profileFailProviders: 2,
    });
    expect(control.stopConditionRisk).toBe("stop");
    expect(control.compatibilityStatus).toBe("blocked");
  });
});

describe("G5d.8 — provider control", () => {
  it("surfaces fallback warning when hook ON", () => {
    const control = buildG5d8ProviderControl(ENV_HOOK_ON, {
      profileResolved: "OK",
      fallbackActive: true,
      resolveSource: "market_default",
      readiness: "warning",
      warning: "market default fallback",
    });
    expect(control.active).toBe(true);
    expect(control.fallbackActive).toBe(true);
    expect(control.warnings.some((w) => /fallback/i.test(w))).toBe(true);
    expect(control.candidateOrderable).toBe(false);
  });
});

describe("G5d.8 — week decision integration", () => {
  it("fail-closed to current when hook ON", () => {
    const decision = buildWeekRuntimeCompatibilityDecision({
      current: [{ dateISO: "2026-09-07", categories: [] }],
      candidate: { hookPhase: "G5d.8" },
    });
    const control = buildG5d8ControlFromWeekDecision(ENV_HOOK_ON, decision);
    expect(decision.selectedSource).toBe("current");
    expect(control.selectedSource).toBe("current");
    expect(control.compatibilityStatus).toBe("fail_closed");
    expect(control.sourceOfTruthChanged).toBe(false);
    expect(control.autoRollout).toBe(false);
  });

  it("blocks when validation fails", () => {
    const decision = buildWeekRuntimeCompatibilityDecision({
      current: [{ dateISO: "2026-09-07" }],
      candidate: { providerId: "secret" },
    });
    const control = buildG5d8ControlFromWeekDecision(ENV_HOOK_ON, decision);
    expect(decision.validation.ok).toBe(false);
    expect(control.compatibilityStatus).toBe("blocked");
    expect(control.stopConditionRisk).toBe("stop");
  });
});

import { describe, expect, test } from "vitest";

import { applyControlGate, controlGate } from "@/lib/ai/control/controlGate";
import { validateAction } from "@/lib/ai/control/governanceEngine";
import { validateEthics } from "@/lib/ai/control/ethicsEngine";
import { assessRisk } from "@/lib/ai/control/riskEngine";
import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { explainControlDecision } from "@/lib/ai/control/explainEngine";

describe("AGI control layer", () => {
  test("validateAction allows safe org types and blocks pricing", () => {
    expect(validateAction({ type: "experiment" })).toBe(true);
    expect(validateAction({ type: "stability_check" })).toBe(true);
    expect(validateAction({ type: "INCREASE_PRICE" })).toBe(false);
    expect(validateAction({ type: "pricing_review" })).toBe(false);
  });

  test("validateEthics blocks deceptive action types", () => {
    expect(validateEthics({ type: "experiment" })).toBe(true);
    expect(validateEthics({ type: "FAKE_SOCIAL_PROOF" })).toBe(false);
  });

  test("assessRisk tiers", () => {
    expect(assessRisk({ type: "experiment" })).toBe("low");
    expect(assessRisk({ type: "optimize" })).toBe("medium");
    expect(assessRisk({ type: "UNKNOWN" })).toBe("high");
  });

  test("applyControlGate filters high risk and respects overrides", () => {
    const pKill = process.env.AI_GLOBAL_KILL_SWITCH;
    const pExp = process.env.AI_DISABLE_EXPERIMENTS;
    const pOpt = process.env.AI_DISABLE_OPTIMIZER;
    delete process.env.AI_GLOBAL_KILL_SWITCH;
    process.env.AI_DISABLE_EXPERIMENTS = "true";
    delete process.env.AI_DISABLE_OPTIMIZER;
    const r = applyControlGate([{ type: "experiment" }, { type: "optimize" }]);
    expect(r.allowed.map((a) => (a as { type: string }).type)).toEqual(["optimize"]);
    expect(r.blocked.some((b) => b.reasons.includes("override_disable_experiments"))).toBe(true);
    if (pKill === undefined) delete process.env.AI_GLOBAL_KILL_SWITCH;
    else process.env.AI_GLOBAL_KILL_SWITCH = pKill;
    if (pExp === undefined) delete process.env.AI_DISABLE_EXPERIMENTS;
    else process.env.AI_DISABLE_EXPERIMENTS = pExp;
    if (pOpt === undefined) delete process.env.AI_DISABLE_OPTIMIZER;
    else process.env.AI_DISABLE_OPTIMIZER = pOpt;
  });

  test("kill switch blocks all actions", () => {
    const prev = process.env.AI_GLOBAL_KILL_SWITCH;
    process.env.AI_GLOBAL_KILL_SWITCH = "true";
    expect(isSystemEnabled()).toBe(false);
    const r = applyControlGate([{ type: "optimize" }]);
    expect(r.allowed).toHaveLength(0);
    expect(r.blocked[0]?.reasons).toContain("kill_switch");
    if (prev === undefined) delete process.env.AI_GLOBAL_KILL_SWITCH;
    else process.env.AI_GLOBAL_KILL_SWITCH = prev;
  });

  test("controlGate returns allowed only", () => {
    const prev = process.env.AI_GLOBAL_KILL_SWITCH;
    delete process.env.AI_GLOBAL_KILL_SWITCH;
    expect(controlGate([{ type: "variant" }])).toHaveLength(1);
    if (prev === undefined) delete process.env.AI_GLOBAL_KILL_SWITCH;
    else process.env.AI_GLOBAL_KILL_SWITCH = prev;
  });

  test("explainControlDecision is structured", () => {
    const ex = explainControlDecision({ type: "optimize" }, { rid: "r1" }, 1000);
    expect(ex.action).toBe("optimize");
    expect(ex.timestamp).toBe(1000);
    expect(ex.state).toEqual({ rid: "r1" });
  });
});

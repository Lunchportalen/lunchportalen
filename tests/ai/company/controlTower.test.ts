import { describe, expect, test } from "vitest";

import { proposeCompanyDecisions } from "@/lib/ai/company/decisionEngine";
import { detectCompanyAnomalies } from "@/lib/ai/company/anomaly";
import { evaluateCompanySafety } from "@/lib/ai/company/safety";
import {
  companyDecisionToSafeDesignPatch,
  runCompanyControlCycle,
} from "@/lib/ai/company/automationEngine";
import { detectSpacingConflictDeniedIds, evaluateCompanyDecision } from "@/lib/ai/company/policyEngine";
import type { CompanyDecision, CompanySnapshot } from "@/lib/ai/company/types";

function baseSnapshot(over: Partial<CompanySnapshot> = {}): CompanySnapshot {
  const base: CompanySnapshot = {
    rid: "rid_test",
    collectedAt: "2026-03-23T12:00:00.000Z",
    revenue: {
      pageViews24h: 100,
      ctaClicks24h: 1,
      ctr: 0.01,
    },
    design: {
      weakPointsCount: 0,
    },
    content: {
      draftPages: 0,
      contentHealthHint: null,
    },
    systemHealth: {
      status: "ok",
      errors24h: 0,
    },
  };
  return {
    ...base,
    ...over,
    revenue: { ...base.revenue, ...over.revenue },
    design: { ...base.design, ...over.design },
    content: { ...base.content, ...over.content },
    systemHealth: { ...base.systemHealth, ...over.systemHealth },
  };
}

describe("company control tower", () => {
  test("proposeCompanyDecisions surfaces growth when CTR is low with volume", () => {
    const snap = baseSnapshot({
      revenue: { pageViews24h: 100, ctaClicks24h: 1, ctr: 0.01 },
    });
    const d = proposeCompanyDecisions(snap);
    const growth = d.find((x) => x.id === "growth_cta_visibility");
    expect(growth).toBeDefined();
    expect(growth?.type).toBe("growth");
    expect(growth?.confidence).toBeGreaterThanOrEqual(0.55);
    expect(growth?.allowedAction).toBe("revenue.optimize");
  });

  test("runCompanyControlCycle caps at two decisions per run", () => {
    const snap = baseSnapshot({
      revenue: { pageViews24h: 200, ctaClicks24h: 1, ctr: 0.005 },
      design: { weakPointsCount: 3, globalSpacingSection: "tight" },
      content: { draftPages: 12, contentHealthHint: 0.5 },
      systemHealth: { status: "degraded", errors24h: 0, detail: "x" },
    });
    const tower = runCompanyControlCycle({ snapshot: snap, mode: "manual" });
    expect(tower.decisions.length).toBeLessThanOrEqual(2);
    expect(tower.policyDecisionLog.length).toBe(tower.decisions.length);
  });

  test("critical health anomaly blocks autopilot in auto mode", () => {
    const snap = baseSnapshot({
      systemHealth: { status: "degraded", errors24h: 0 },
      revenue: { pageViews24h: 200, ctaClicks24h: 1, ctr: 0.005 },
      design: { weakPointsCount: 3 },
    });
    const anomalies = detectCompanyAnomalies(snap);
    const safety = evaluateCompanySafety({ mode: "auto", anomalies });
    expect(safety.autopilotAllowed).toBe(false);
    expect(safety.alertLevel).toBe("critical");

    const tower = runCompanyControlCycle({ snapshot: snap, mode: "auto" });
    expect(tower.autoExecutable.length).toBe(0);
  });

  test("evaluateCompanyDecision: manual is suggestions-only", () => {
    const decision: CompanyDecision = {
      id: "x",
      type: "product",
      action: "relax tight global spacing",
      confidence: 0.9,
      reason: "test",
      risk: "low",
      channel: "design_optimizer",
      allowedAction: "design.update",
    };
    const r = evaluateCompanyDecision(decision, { mode: "manual" });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("manual");
    expect(r.allowedAction).toBe("design.update");
    expect(r.riskLevel).toBe("low");
  });

  test("evaluateCompanyDecision: assisted allows low-risk design.update", () => {
    const decision: CompanyDecision = {
      id: "x",
      type: "product",
      action: "widen vertical rhythm (spacing.section)",
      confidence: 0.74,
      reason: "test",
      risk: "low",
      channel: "design_optimizer",
      allowedAction: "design.update",
    };
    const r = evaluateCompanyDecision(decision, { mode: "assisted" });
    expect(r.allowed).toBe(true);
    expect(r.allowedAction).toBe("design.update");
  });

  test("evaluateCompanyDecision: unknown allowlisted action denies", () => {
    const decision: CompanyDecision = {
      id: "ceo_stabilize_platform",
      type: "ceo",
      action: "prioritize platform stability before growth experiments",
      confidence: 0.9,
      reason: "test",
      risk: "high",
      channel: "system_ops",
    };
    const r = evaluateCompanyDecision(decision, { mode: "assisted" });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("unknown_action");
    expect(r.allowedAction).toBeNull();
  });

  test("evaluateCompanyDecision: auto denies medium risk", () => {
    const decision: CompanyDecision = {
      id: "growth_cta_visibility",
      type: "growth",
      action: "increase CTA visibility",
      confidence: 0.82,
      reason: "ctr low",
      risk: "medium",
      channel: "revenue_insights",
      allowedAction: "revenue.optimize",
    };
    const r = evaluateCompanyDecision(decision, {
      mode: "auto",
      hasAnomalies: false,
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("auto_denies_medium_risk");
  });

  test("evaluateCompanyDecision: assisted medium requires explicit approval", () => {
    const decision: CompanyDecision = {
      id: "growth_cta_visibility",
      type: "growth",
      action: "increase CTA visibility",
      confidence: 0.82,
      reason: "ctr low",
      risk: "medium",
      channel: "revenue_insights",
      allowedAction: "revenue.optimize",
    };
    const denied = evaluateCompanyDecision(decision, { mode: "assisted" });
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toContain("explicit_approval");

    const ok = evaluateCompanyDecision(decision, {
      mode: "assisted",
      explicitApproveIds: ["growth_cta_visibility"],
    });
    expect(ok.allowed).toBe(true);
  });

  test("evaluateCompanyDecision: human override allows high risk", () => {
    const decision: CompanyDecision = {
      id: "ux_high_risk",
      type: "product",
      action: "major layout restructuring",
      confidence: 0.9,
      reason: "test",
      risk: "high",
      channel: "design_optimizer",
      allowedAction: "design.update",
    };
    const r = evaluateCompanyDecision(decision, {
      mode: "auto",
      forceOverride: true,
    });
    expect(r.allowed).toBe(true);
    expect(r.override).toBe(true);
  });

  test("detectSpacingConflictDeniedIds blocks wide+tight in same batch", () => {
    const wide: CompanyDecision = {
      id: "a_wide",
      type: "product",
      action: "relax tight global spacing",
      confidence: 0.7,
      reason: "r",
      risk: "low",
      channel: "design_optimizer",
      allowedAction: "design.update",
    };
    const tight: CompanyDecision = {
      id: "b_tight",
      type: "product",
      action: "tighten vertical rhythm for density",
      confidence: 0.7,
      reason: "r",
      risk: "low",
      channel: "design_optimizer",
      allowedAction: "design.update",
    };
    const deny = detectSpacingConflictDeniedIds([wide, tight]);
    expect(deny.has("a_wide")).toBe(true);
    expect(deny.has("b_tight")).toBe(true);
  });

  test("companyDecisionToSafeDesignPatch maps spacing intents to wide section", () => {
    const decision: CompanyDecision = {
      id: "product_relax_tight_spacing",
      type: "product",
      action: "relax tight global spacing",
      confidence: 0.68,
      reason: "test",
      risk: "low",
      channel: "design_optimizer",
      allowedAction: "design.update",
    };
    const patch = companyDecisionToSafeDesignPatch(decision);
    expect(patch).toEqual({ spacing: { section: "wide" } });
  });
});

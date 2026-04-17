import { describe, expect, test } from "vitest";

import { mapRealityActions } from "@/lib/ai/reality/actionMapper";
import { alignPerception } from "@/lib/ai/reality/alignmentEngine";
import { buildNarrative } from "@/lib/ai/reality/narrativeEngine";
import { optimizeCognitiveFlow } from "@/lib/ai/reality/cognitiveFlowEngine";
import { buildPerceptionState } from "@/lib/ai/reality/perceptionEngine";
import { reinforceTrust } from "@/lib/ai/reality/trustEngine";
import { buildRealityStrategy } from "@/lib/ai/reality/strategyEngine";

describe("reality (perception alignment) engines", () => {
  test("buildPerceptionState clamps inputs", () => {
    const s = buildPerceptionState({ clarity: 2, trust: -1, differentiation: 0.5, consistency: 0.8, friction: 0.3 });
    expect(s.clarity).toBe(1);
    expect(s.trust).toBe(0);
    expect(s.differentiation).toBe(0.5);
  });

  test("alignPerception triggers all levers on weak state", () => {
    const weak = buildPerceptionState({
      clarity: 0.5,
      trust: 0.5,
      differentiation: 0.4,
      consistency: 0.5,
      friction: 0.5,
    });
    const a = alignPerception(weak);
    expect(a).toContain("IMPROVE_MESSAGING");
    expect(a).toContain("ADD_TRUST_SIGNALS");
    expect(a).toContain("STRENGTHEN_POSITIONING");
    expect(a).toContain("REDUCE_FRICTION");
    expect(a).toContain("INCREASE_CONSISTENCY");
  });

  test("narrative derives from alignment", () => {
    const n = buildNarrative(["IMPROVE_MESSAGING", "ADD_TRUST_SIGNALS"]);
    expect(n).toEqual(["CLEAR_VALUE_PROPOSITION", "SOCIAL_PROOF"]);
  });

  test("buildRealityStrategy concatenates buckets", () => {
    const strat = buildRealityStrategy(["A"], ["B"], ["C"], ["D"]);
    expect(strat).toEqual(["A", "B", "C", "D"]);
  });

  test("mapRealityActions dedupes org types", () => {
    const mapped = mapRealityActions([
      "IMPROVE_MESSAGING",
      "SIMPLIFY_COPY",
      "SOCIAL_PROOF",
      "CATEGORY_AUTHORITY",
    ]);
    expect(mapped.map((x) => x.type)).toEqual(["optimize", "variant", "experiment"]);
  });

  test("trust and flow engines are deterministic", () => {
    const s = buildPerceptionState({ clarity: 1, trust: 0.5, differentiation: 1, consistency: 1, friction: 0.5 });
    expect(reinforceTrust(s).length).toBeGreaterThan(0);
    expect(optimizeCognitiveFlow(s).length).toBeGreaterThan(0);
  });
});

/**
 * CRO scoring: deterministic score, breakdown, fail-safe.
 */
import { describe, test, expect } from "vitest";
import { analyzePageForCro } from "@/lib/cro/pageAnalysis";
import {
  computeCroScore,
  failSafeCroScore,
  CRO_SCORE_CONSTANTS,
  type CroScoreBreakdown,
} from "@/lib/cro/scoring";

describe("computeCroScore", () => {
  test("invalid analysis returns fail-safe (score 0, totalDeduction 100)", () => {
    expect(computeCroScore({ analysis: null }).score).toBe(0);
    expect(computeCroScore({ analysis: null }).totalDeduction).toBe(100);
    expect(computeCroScore({ analysis: undefined }).score).toBe(0);
    const invalid = computeCroScore({ analysis: {} as any });
    expect(invalid.score).toBe(0);
    expect(invalid.breakdown).toEqual({
      cta: 0,
      weakCta: 0,
      headline: 0,
      valueProps: 0,
      intro: 0,
      trustSignals: 0,
      friction: 0,
      offerClarity: 0,
      structure: 0,
      multipleCtas: 0,
    });
  });

  test("failSafeCroScore matches invalid-input result", () => {
    const failSafe = failSafeCroScore();
    expect(failSafe.score).toBe(0);
    expect(failSafe.totalDeduction).toBe(100);
    expect(computeCroScore({ analysis: null })).toEqual(failSafe);
  });

  test("score is 0–100", () => {
    const empty = analyzePageForCro({ blocks: [], meta: {} });
    const r = computeCroScore({ analysis: empty });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);

    const full = analyzePageForCro({
      blocks: [
        { id: "h1", type: "hero", data: { title: "Firmalunsj som fungerer" } },
        {
          id: "r1",
          type: "richText",
          data: { heading: "Fordeler", body: "Sikkerhet og compliance. Be om demo for å komme i gang." },
        },
        { id: "c1", type: "cta", data: { title: "Be om demo", buttonLabel: "Be om demo" } },
      ],
      meta: { cro: { trustSignals: ["Sikkerhet"] } },
    });
    const r2 = computeCroScore({ analysis: full });
    expect(r2.score).toBeGreaterThanOrEqual(0);
    expect(r2.score).toBeLessThanOrEqual(100);
  });

  test("empty page has no deductions (score 100)", () => {
    const analysis = analyzePageForCro({ blocks: [], meta: {} });
    const r = computeCroScore({ analysis });
    expect(r.breakdown).toBeDefined();
    expect(r.totalDeduction).toBe(0);
    expect(r.score).toBe(100);
  });

  test("page with content but no CTA has cta deduction", () => {
    const analysis = analyzePageForCro({
      blocks: [{ id: "r1", type: "richText", data: { body: "Intro text." } }],
      meta: {},
    });
    const r = computeCroScore({ analysis });
    expect(r.breakdown.cta).toBe(CRO_SCORE_CONSTANTS.MISSING_CTA_DEDUCTION);
    expect(r.score).toBe(100 - r.totalDeduction);
  });

  test("weak CTA adds weakCta deduction", () => {
    const analysis = analyzePageForCro({
      blocks: [{ id: "c1", type: "cta", data: { buttonLabel: "Klikk her", title: "Go" } }],
      meta: {},
    });
    const r = computeCroScore({ analysis });
    expect(r.breakdown.weakCta).toBe(CRO_SCORE_CONSTANTS.WEAK_CTA_DEDUCTION);
  });

  test("missing headline adds headline deduction", () => {
    const analysis = analyzePageForCro({
      blocks: [{ id: "r1", type: "richText", data: { body: "No heading" } }],
      meta: {},
    });
    const r = computeCroScore({ analysis });
    expect(r.breakdown.headline).toBe(CRO_SCORE_CONSTANTS.MISSING_HEADLINE_DEDUCTION);
  });

  test("good page has high score and zero or low deductions", () => {
    const analysis = analyzePageForCro({
      blocks: [
        { id: "h1", type: "hero", data: { title: "Firmalunsj som fungerer" } },
        {
          id: "r1",
          type: "richText",
          data: {
            heading: "Fordeler",
            body: "Sikkerhet og compliance. Enkel oppsett. Be om demo for å komme i gang.",
          },
        },
        { id: "c1", type: "cta", data: { title: "Be om demo", buttonLabel: "Be om demo" } },
      ],
      meta: { cro: { trustSignals: ["Sikkerhet"] } },
    });
    const r = computeCroScore({ analysis });
    expect(r.breakdown.cta).toBe(0);
    expect(r.breakdown.weakCta).toBe(0);
    expect(r.breakdown.headline).toBe(0);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  test("same analysis yields same score (deterministic)", () => {
    const analysis = analyzePageForCro({
      blocks: [
        { id: "r1", type: "richText", data: { heading: "H", body: "Short." } },
        { id: "c1", type: "cta", data: { buttonLabel: "Send", title: "" } },
      ],
      meta: {},
    });
    const r1 = computeCroScore({ analysis });
    const r2 = computeCroScore({ analysis });
    expect(r1.score).toBe(r2.score);
    expect(r1.totalDeduction).toBe(r2.totalDeduction);
    expect(r1.breakdown).toEqual(r2.breakdown);
  });

  test("breakdown sums to totalDeduction", () => {
    const analysis = analyzePageForCro({
      blocks: [
        { id: "r1", type: "richText", data: { body: "Short." } },
        { id: "c1", type: "cta", data: { buttonLabel: "Klikk her", title: "" } },
      ],
      meta: {},
    });
    const r = computeCroScore({ analysis });
    const b = r.breakdown as CroScoreBreakdown;
    const sum =
      b.cta +
      b.weakCta +
      b.headline +
      b.valueProps +
      b.intro +
      b.trustSignals +
      b.friction +
      b.offerClarity +
      b.structure +
      b.multipleCtas;
    expect(sum).toBe(r.totalDeduction);
  });

  test("score equals 100 minus totalDeduction (capped)", () => {
    const analysis = analyzePageForCro({
      blocks: [
        { id: "r1", type: "richText", data: { body: "x" } },
        { id: "r2", type: "richText", data: { body: "y" } },
        { id: "r3", type: "richText", data: { body: "z" } },
        { id: "r4", type: "richText", data: { body: "w" } },
        { id: "r5", type: "richText", data: { body: "v" } },
        { id: "c1", type: "cta", data: { buttonLabel: "Submit", title: "" } },
      ],
      meta: {},
    });
    const r = computeCroScore({ analysis });
    expect(r.score).toBe(Math.max(0, 100 - r.totalDeduction));
  });

  test("score changes deterministically when content improves (add clear CTA and value props)", () => {
    const weak = analyzePageForCro({
      blocks: [
        { id: "r1", type: "richText", data: { body: "Short." } },
        { id: "c1", type: "cta", data: { buttonLabel: "Klikk her", title: "" } },
      ],
      meta: {},
    });
    const strong = analyzePageForCro({
      blocks: [
        { id: "h1", type: "hero", data: { title: "Firmalunsj som fungerer" } },
        {
          id: "r1",
          type: "richText",
          data: { heading: "Fordeler", body: "Sikkerhet og compliance. Be om demo for å komme i gang." },
        },
        { id: "c1", type: "cta", data: { title: "Be om demo", buttonLabel: "Be om demo" } },
      ],
      meta: { cro: { trustSignals: ["Sikkerhet"] } },
    });
    const rWeak = computeCroScore({ analysis: weak });
    const rStrong = computeCroScore({ analysis: strong });
    expect(rStrong.score).toBeGreaterThan(rWeak.score);
  });
});

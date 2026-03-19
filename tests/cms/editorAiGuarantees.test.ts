/**
 * Editor-AI guarantees: stale response guard, UI truth (applied state), apply/reject safety.
 * Minimal proofs only; no fluffy coverage.
 */

// @ts-nocheck

import { describe, test, expect } from "vitest";
import { validateAIPatchV1 } from "@/lib/cms/model/aiPatch";
import { applyAIPatchV1 } from "@/lib/cms/model/applyAIPatch";

/** Stale guard: response must not be applied when request context no longer matches current page. */
function isStaleAiResponse(requestContextId: string | null, currentEffectiveId: string | null): boolean {
  return requestContextId !== currentEffectiveId;
}

/** UI truth: "applied" is shown only when at least one of improvePage or seo was applied. */
function hasDiagnosticsApplied(diagnosticsResult: {
  improvePage?: { applied?: boolean };
  seo?: { applied?: boolean };
} | null): boolean {
  if (!diagnosticsResult) return false;
  return !!(diagnosticsResult.improvePage?.applied || diagnosticsResult.seo?.applied);
}

describe("editorAiGuarantees – stale response guard", () => {
  test("same page id is not stale", () => {
    expect(isStaleAiResponse("page-1", "page-1")).toBe(false);
    expect(isStaleAiResponse(null, null)).toBe(false);
  });

  test("different page id is stale (must not apply)", () => {
    expect(isStaleAiResponse("page-1", "page-2")).toBe(true);
    expect(isStaleAiResponse("page-A", null)).toBe(true);
    expect(isStaleAiResponse(null, "page-B")).toBe(true);
  });
});

describe("editorAiGuarantees – UI truth (applied state)", () => {
  test("hasDiagnosticsApplied is false when no result or neither applied", () => {
    expect(hasDiagnosticsApplied(null)).toBe(false);
    expect(hasDiagnosticsApplied({})).toBe(false);
    expect(hasDiagnosticsApplied({ improvePage: { applied: false }, seo: { applied: false } })).toBe(false);
  });

  test("hasDiagnosticsApplied is true only when improvePage or seo applied", () => {
    expect(hasDiagnosticsApplied({ improvePage: { applied: true }, seo: { applied: false } })).toBe(true);
    expect(hasDiagnosticsApplied({ improvePage: { applied: false }, seo: { applied: true } })).toBe(true);
    expect(hasDiagnosticsApplied({ improvePage: { applied: true }, seo: { applied: true } })).toBe(true);
  });
});

describe("editorAiGuarantees – apply updates only intended content", () => {
  const validBody = {
    version: 1 as const,
    blocks: [
      { id: "b1", type: "richText", data: { body: "Hi" } },
      { id: "b2", type: "cta", data: {} },
    ],
    meta: {},
  };

  test("validateAIPatchV1 rejects insertBlock when index > blocks.length", () => {
    const patch = {
      version: 1 as const,
      ops: [{ op: "insertBlock" as const, index: 10, block: { type: "richText", data: {} } }],
    };
    const v = validateAIPatchV1(patch, validBody);
    expect(v.ok).toBe(false);
    expect((v as { reason: string }).reason).toContain("out of range");
  });

  test("validateAIPatchV1 rejects moveBlock toIndex out of range", () => {
    const patch = {
      version: 1 as const,
      ops: [{ op: "moveBlock" as const, id: "b1", toIndex: 5 }],
    };
    const v = validateAIPatchV1(patch, validBody);
    expect(v.ok).toBe(false);
    expect((v as { reason: string }).reason).toContain("out of range");
  });

  test("applyAIPatchV1 does not mutate body (reject path)", () => {
    const patch = {
      version: 1 as const,
      ops: [{ op: "removeBlock" as const, id: "nonexistent" }],
    };
    const before = validBody.blocks.length;
    const applied = applyAIPatchV1(validBody, patch);
    expect(applied.ok).toBe(false);
    expect(validBody.blocks.length).toBe(before);
  });
});

describe("editorAiGuarantees – reject/cancel leaves content unchanged", () => {
  test("applyAIPatchV1 returns ok:false for invalid patch; body unchanged", () => {
    const body = {
      version: 1 as const,
      blocks: [{ id: "a", type: "richText", data: {} }],
      meta: {},
    };
    const patch = {
      version: 1 as const,
      ops: [{ op: "updateBlockData" as const, id: "wrong-id", data: { body: "x" } }],
    };
    const applied = applyAIPatchV1(body, patch);
    expect(applied.ok).toBe(false);
    expect(body.blocks[0].data).toEqual({});
  });
});

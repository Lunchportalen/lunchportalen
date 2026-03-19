/**
 * Deterministic fallback when AI/provider is unavailable.
 * - isAIEnabled() drives 503 FEATURE_DISABLED on suggest/block-builder etc.
 * - Page builder is deterministic (no LLM) so does not depend on isAIEnabled.
 */

import { describe, test, expect } from "vitest";
import { generatePageStructure, generatePageFromStructuredInput } from "@/lib/ai/tools/pageBuilder";

describe("AI deterministic fallback (no provider)", () => {
  test("generatePageStructure works without provider (deterministic, no LLM)", async () => {
    const out = await generatePageStructure("Test side", "nb");
    expect(out.blocks).toBeDefined();
    expect(Array.isArray(out.blocks)).toBe(true);
    expect(out.title).toBeDefined();
  });

  test("generatePageFromStructuredInput works without provider (pure function)", () => {
    const out = generatePageFromStructuredInput({
      pageType: "landing",
      locale: "nb",
    });
    expect(out.blocks.length).toBeGreaterThan(0);
    expect(out.title).toBeDefined();
  });
});

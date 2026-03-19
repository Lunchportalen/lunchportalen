/**
 * SEO recommendation: tool policy allows patch and metaSuggestion.
 * Used by suggest/apply for persistence path.
 */

import { describe, test, expect } from "vitest";
import { getToolPolicy, AI_TOOL_IDS } from "@/lib/ai/tools/registry";

describe("SEO recommendation tool policy", () => {
  test("seo.optimize.page is a registered tool", () => {
    expect(AI_TOOL_IDS).toContain("seo.optimize.page");
  });

  test("getToolPolicy(seo.optimize.page) returns policy with patchAllowed and outputs", () => {
    const policy = getToolPolicy("seo.optimize.page");
    expect(policy).toBeDefined();
    expect(policy?.role).toBe("superadmin");
    expect(policy?.patchAllowed).toBe(true);
    expect(policy?.docs?.outputs).toContain("patch");
    expect(policy?.docs?.outputs).toContain("metaSuggestion");
  });
});

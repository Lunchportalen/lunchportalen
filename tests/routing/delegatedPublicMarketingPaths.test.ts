import { afterEach, describe, expect, it, vi } from "vitest";

import { delegatedPublicMarketingPathnames } from "@/lib/routing/delegatedPublicMarketingPaths";

describe("delegatedPublicMarketingPathnames", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("includes root, registry keys, faq, registrering, and default extra slug", () => {
    const s = delegatedPublicMarketingPathnames();
    expect(s.has("/")).toBe(true);
    expect(s.has("/kontakt")).toBe(true);
    expect(s.has("/faq")).toBe(true);
    expect(s.has("/registrering")).toBe(true);
    expect(s.has("/phase1-demo")).toBe(true);
  });

  it("honors LP_MARKETING_UMBRACO_EXTRA_SLUG for extra pathname", () => {
    vi.stubEnv("LP_MARKETING_UMBRACO_EXTRA_SLUG", "custom-slug");
    const s = delegatedPublicMarketingPathnames();
    expect(s.has("/custom-slug")).toBe(true);
  });
});

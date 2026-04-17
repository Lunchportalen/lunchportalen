/**
 * Regression: every path in marketing-registry.json must map to an Umbraco Delivery allowlisted slug
 * (public HTML editorial truth — no parallel Next-owned primary for those routes).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import registryData from "@/lib/seo/marketing-registry.json";
import { marketingSlugFromRegistryPath, marketingUmbracoAllowlistedSlugs } from "@/lib/cms/umbraco/marketingAdapter";

describe("marketing-registry.json ↔ Umbraco allowlist", () => {
  beforeEach(() => {
    vi.stubEnv("LP_MARKETING_UMBRACO_EXTRA_SLUG", "phase1-demo");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("every registry path resolves to a slug on the Delivery allowlist", () => {
    const s = marketingUmbracoAllowlistedSlugs();
    const keys = Object.keys(registryData as Record<string, unknown>);
    expect(keys.length).toBeGreaterThan(0);
    for (const path of keys) {
      const slug = marketingSlugFromRegistryPath(path);
      expect(s.has(slug)).toBe(true);
    }
  });
});

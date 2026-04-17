/**
 * Closeout: prove which public routes are Umbraco Delivery–driven vs static Next,
 * and that SEO metadata is derived from the same body object as blocks (no parallel hardcoded SEO for CMS pages).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { buildCmsPageMetadata } from "@/lib/cms/public/cmsPageMetadata";
import {
  isPublicUmbracoEditorialFallbackSlug,
  marketingUmbracoAllowlistedSlugs,
} from "@/lib/cms/umbraco/marketingAdapter";

describe("Umbraco publish chain — allowlist parity (repo truth)", () => {
  beforeEach(() => {
    vi.stubEnv("LP_MARKETING_UMBRACO_EXTRA_SLUG", "phase1-demo");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("allowlist includes all marketing-registry paths + faq + registrering + extra demo slug", () => {
    const s = marketingUmbracoAllowlistedSlugs();
    expect(s.has("home")).toBe(true);
    expect(s.has("om-oss")).toBe(true);
    expect(s.has("kontakt")).toBe(true);
    expect(s.has("personvern")).toBe(true);
    expect(s.has("vilkar")).toBe(true);
    expect(s.has("faq")).toBe(true);
    expect(s.has("registrering")).toBe(true);
    expect(s.has("phase1-demo")).toBe(true);
    expect(s.has("hvordan")).toBe(true);
    expect(s.has("lunsjordning")).toBe(true);
    expect(s.has("alternativ-til-kantine")).toBe(true);
    expect(s.has("priser")).toBe(true);
    expect(s.has("sikkerhet")).toBe(true);
    expect(s.has("pitch")).toBe(true);
    expect(s.has("investor")).toBe(true);
    expect(s.has("ai-motor-demo")).toBe(true);
  });

  test("editorial fallback applies to all allowlisted slugs except home", () => {
    expect(isPublicUmbracoEditorialFallbackSlug("home")).toBe(false);
    expect(isPublicUmbracoEditorialFallbackSlug("faq")).toBe(true);
    expect(isPublicUmbracoEditorialFallbackSlug("registrering")).toBe(true);
    expect(isPublicUmbracoEditorialFallbackSlug("om-oss")).toBe(true);
    expect(isPublicUmbracoEditorialFallbackSlug("random-slug")).toBe(false);
  });

  test("buildCmsPageMetadata reads SEO from body.meta (same payload as block parse path)", () => {
    const body = {
      version: 1,
      blocks: [],
      meta: {
        seo: {
          title: "SEO tittel fra CMS-body",
          description: "Beskrivelse fra CMS-body",
        },
      },
    };
    const m = buildCmsPageMetadata({
      pageTitle: "Fallback sidetittel",
      slug: "om-oss",
      body,
    });
    expect(String(m.title)).toContain("SEO tittel fra CMS-body");
    expect(m.description).toBe("Beskrivelse fra CMS-body");
  });
});

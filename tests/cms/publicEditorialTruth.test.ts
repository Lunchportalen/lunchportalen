import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { canonicalPathForPublicEditorialSlug } from "@/lib/cms/public/canonicalPathForPublicEditorialSlug";
import { buildEditorialFallbackPublicBody } from "@/lib/cms/seed/editorialFallbackHomeBody";

/**
 * Regression guard: public `/` must not use rich coded marketing as hidden editorial truth when live sources miss.
 * @see loadPublicPageWithTrustFallback — home path uses buildEditorialFallbackPublicBody()
 */
describe("public editorial fallback (Umbraco truth lock)", () => {
  test("buildEditorialFallbackPublicBody is empty blocks and explicitly not editorial live", () => {
    const body = buildEditorialFallbackPublicBody();
    expect(body.version).toBe(1);
    expect(Array.isArray(body.blocks)).toBe(true);
    expect(body.blocks.length).toBe(0);
    const meta = body.meta as { surface?: string; notEditorialLive?: boolean };
    expect(meta.surface).toBe("lp_editorial_fallback");
    expect(meta.notEditorialLive).toBe(true);
  });

  test("app/(public)/page.tsx must not reintroduce legacy static marketing SEO strings", () => {
    const p = join(process.cwd(), "app", "(public)", "page.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).not.toContain("firmalunsj med kontroll og forutsigbarhet");
  });

  test("app/(auth)/registrering/page.tsx must not use export const metadata as primary editorial SEO (Umbraco chain)", () => {
    const p = join(process.cwd(), "app", "(auth)", "registrering", "page.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("generateMetadata");
    expect(src).toContain("loadPublicPageWithTrustFallback");
    expect(src).toContain("generatePublicCmsSlugMetadata");
    expect(src).not.toMatch(/export const metadata\s*:\s*Metadata/);
  });

  test("app/(public)/kontakt/page.tsx must use shared generatePublicCmsSlugMetadata (same body + metadata chain)", () => {
    const p = join(process.cwd(), "app", "(public)", "kontakt", "page.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("generatePublicCmsSlugMetadata");
    expect(src).toContain('generatePublicCmsSlugMetadata("kontakt"');
  });

  test("publicCmsSlugRoute must not use fake 404 metadata when editorial row is missing (fail-closed instead)", () => {
    const p = join(process.cwd(), "lib", "cms", "public", "publicCmsSlugRoute.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).not.toContain("Siden finnes ikke");
    expect(src).toContain("PublicCmsStructuredData");
    expect(src).toContain("data-lp-public-cms-slug");
  });

  test("public getContentBySlug must not return live-supabase for public marketing resolver", () => {
    const p = join(process.cwd(), "lib", "cms", "public", "getContentBySlug.ts");
    const src = readFileSync(p, "utf8");
    expect(src).toContain("Non-allowlisted slugs: public resolver does not read Supabase");
    expect(src).not.toMatch(/publicContentOrigin:\s*["']live-supabase["']/);
  });

  test("canonicalPathForPublicEditorialSlug maps home ↔ /", () => {
    expect(canonicalPathForPublicEditorialSlug("home")).toBe("/");
    expect(canonicalPathForPublicEditorialSlug("kontakt")).toBe("/kontakt");
  });

  test("former Next-owned marketing demos must use PublicCmsSlugPageView (pitch, investor, ai-motor-demo)", () => {
    for (const seg of ["pitch", "investor", "ai-motor-demo"]) {
      const p = join(process.cwd(), "app", "(public)", seg, "page.tsx");
      const src = readFileSync(p, "utf8");
      expect(src).toContain("PublicCmsSlugPageView");
      expect(src).toContain("generatePublicCmsSlugMetadata");
      expect(src).not.toContain('"use client"');
    }
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { buildEditorialFallbackPublicBody } from "@/lib/cms/seed/editorialFallbackHomeBody";

/**
 * Regression guard: public `/` must not use rich coded marketing as hidden editorial truth when live sources miss.
 * Editorial fallback body remains the fail-closed shape for overlay/seed paths (FASE 14-UI-2).
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

  test("app/(auth)/registrering/page.tsx uses static app metadata (no Umbraco marketing chain)", () => {
    const p = join(process.cwd(), "app", "(auth)", "registrering", "page.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).toMatch(/export const metadata\s*:\s*Metadata/);
    expect(src).not.toContain("loadPublicPageWithTrustFallback");
    expect(src).not.toContain("generatePublicCmsSlugMetadata");
    expect(src).not.toContain("CmsBlockRenderer");
  });
});

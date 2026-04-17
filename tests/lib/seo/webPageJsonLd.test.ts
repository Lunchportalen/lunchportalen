import { describe, expect, test } from "vitest";
import { EDITORIAL_FAIL_CLOSED_DESCRIPTION } from "@/lib/cms/public/editorialFailClosedMetadata";
import { buildEditorialFallbackPublicBody } from "@/lib/cms/seed/editorialFallbackHomeBody";
import { organizationJsonLd, webPageJsonLd } from "@/lib/seo/jsonld";
import { canonicalForPath } from "@/lib/seo/site";

describe("webPageJsonLd — public pages must not throw on missing SEO fields", () => {
  test("empty description falls back to name (live CMS without meta.seo.description)", () => {
    const ld = webPageJsonLd({
      url: "/hvordan",
      name: "Slik fungerer det",
      description: "",
    });
    expect(ld).toMatchObject({
      "@type": "WebPage",
      name: "Slik fungerer det",
      description: "Slik fungerer det",
    });
    expect(ld).not.toHaveProperty("error");
  });

  test("empty name and description use site name (deterministic minimum)", () => {
    const ld = webPageJsonLd({
      url: "/",
      name: "",
      description: "",
    });
    expect(ld).toMatchObject({
      "@type": "WebPage",
      name: "Lunchportalen",
      description: "Lunchportalen",
    });
  });

  test("fail-closed editorial line is valid WebPage description", () => {
    const ld = webPageJsonLd({
      url: "/",
      name: "Lunchportalen",
      description: EDITORIAL_FAIL_CLOSED_DESCRIPTION,
    });
    expect(String((ld as { description?: string }).description)).toContain("ikke tilgjengelig");
  });

  test("throws only when url resolves empty (misconfiguration)", () => {
    expect(() =>
      webPageJsonLd({
        url: "",
        name: "X",
        description: "Y",
      }),
    ).toThrow("SEO_JSONLD_WEBPAGE_INVALID");
  });

  test("regression: home JSON-LD graph (org + WebPage) never throws for editorial fallback body", () => {
    const body = buildEditorialFallbackPublicBody();
    expect(body.meta).toMatchObject({ surface: "lp_editorial_fallback" });
    const name = "Lunchportalen";
    const description = EDITORIAL_FAIL_CLOSED_DESCRIPTION;
    expect(() =>
      JSON.stringify([organizationJsonLd(), webPageJsonLd({ url: canonicalForPath("/"), name, description })]),
    ).not.toThrow();
  });

  test("regression: live body without meta.seo.description — WebPage uses title/name as description", () => {
    expect(() =>
      webPageJsonLd({
        url: canonicalForPath("/"),
        name: "Forside",
        description: "",
      }),
    ).not.toThrow();
  });
});

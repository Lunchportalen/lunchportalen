import { describe, it, expect, vi, afterEach } from "vitest";
import {
  assertMarketingRegistry,
  collectValidMarketingPages,
  listMarketingPages,
  type MarketingPage,
  type MarketingRegistry,
} from "@/lib/seo/marketingRegistry";

afterEach(() => {
  vi.restoreAllMocks();
});

function minimalPage(overrides: Partial<MarketingPage> & Pick<MarketingPage, "path" | "title">): MarketingPage {
  const path = overrides.path;
  return {
    path,
    title: overrides.title,
    description: overrides.description ?? "desc",
    pageType: "website",
    ogImage: "/og/og-default-1200x630.jpg",
    isIndexable: true,
    priority: 0.5,
    changefreq: "monthly",
    breadcrumbs: [
      { name: "Forside", item: "/" },
      { name: overrides.title, item: path },
    ],
    intentLinks: overrides.intentLinks ?? [{ href: "/lunsjordning", label: "Lunsjordning for bedrifter" }],
    ...overrides,
  };
}

describe("marketingRegistry — sitemap / validation", () => {
  it("committed registry passes full assert (no SEO_REGISTRY_* throw)", () => {
    expect(() => assertMarketingRegistry()).not.toThrow();
  });

  it("listMarketingPages includes home and a known pillar route when registry is valid", () => {
    const pages = listMarketingPages();
    expect(pages.some((p) => p.path === "/")).toBe(true);
    expect(pages.some((p) => p.path === "/lunsjordning")).toBe(true);
  });

  it("collectValidMarketingPages skips intent link to / for non-root pages without throwing", () => {
    const good = minimalPage({
      path: "/good",
      title: "Good",
      intentLinks: [{ href: "/bad", label: "See bad" }],
    });
    const bad = minimalPage({
      path: "/bad",
      title: "Bad",
      intentLinks: [{ href: "/", label: "Forside" }],
    });
    const reg = { "/good": good, "/bad": bad } as MarketingRegistry;

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const out = collectValidMarketingPages(reg);
    expect(out).toHaveLength(1);
    expect(out[0]?.path).toBe("/good");
    expect(warn).toHaveBeenCalled();
    const first = warn.mock.calls[0]?.[0];
    expect(String(first)).toContain("SEO_REGISTRY_INTENT_INVALID_TARGET");
  });

  it("rejects intent href with colon corruption (e.g. trailing :)", () => {
    const a = minimalPage({
      path: "/a",
      title: "A",
      intentLinks: [{ href: "/b", label: "B" }],
    });
    const b = minimalPage({
      path: "/b",
      title: "B",
      intentLinks: [{ href: "/pitch:/", label: "broken" }],
    });
    const reg = { "/a": a, "/b": b } as MarketingRegistry;

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const out = collectValidMarketingPages(reg);
    expect(out).toHaveLength(1);
    expect(out[0]?.path).toBe("/a");
    expect(warn).toHaveBeenCalled();
    const msg = String(warn.mock.calls.find((c) => String(c[0]).includes("/b"))?.[0] ?? "");
    expect(msg).toContain("SEO_REGISTRY_INTENT_HREF_CORRUPT");
  });
});

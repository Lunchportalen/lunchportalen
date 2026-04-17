/** @vitest-environment node */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

type BlockLike = {
  data?: Record<string, unknown>;
};

function extractBlockText(block: BlockLike | null | undefined): string {
  const data =
    block && typeof block === "object" && !Array.isArray(block) && block.data ?
      block.data
    : {};
  return [data.title, data.heading, data.subtitle, data.body, data.buttonLabel]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/components/PageShell", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "page-shell" }, children),
}));

vi.mock("@/components/cms/CmsBlockRenderer", () => ({
  CmsBlockRenderer: ({ blocks }: { blocks: BlockLike[] }) =>
    React.createElement(
      "div",
      { "data-testid": "cms-block-renderer" },
      (Array.isArray(blocks) ? blocks : []).map((block, index) =>
        React.createElement("p", { key: index }, extractBlockText(block)),
      ),
    ),
}));

const originalLocalRuntimeFlag = process.env.LP_LOCAL_CMS_RUNTIME;
(global as typeof globalThis & { React?: unknown }).React = React;

describe("Public seeded content render", () => {
  beforeEach(() => {
    process.env.LP_LOCAL_CMS_RUNTIME = "1";
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalLocalRuntimeFlag === undefined) delete process.env.LP_LOCAL_CMS_RUNTIME;
    else process.env.LP_LOCAL_CMS_RUNTIME = originalLocalRuntimeFlag;
  });

  it("loads seeded blocks for /bestilling-og-sporsmal from local runtime truth", async () => {
    const { loadLivePageContent } = await import("@/lib/cms/public/loadLivePageContent");

    const content = await loadLivePageContent("bestilling-og-sporsmal");

    expect(content).not.toBeNull();
    expect(content?.pageId).toBe("00000000-0000-4000-8000-00000000c002");
    expect(content?.slug).toBe("bestilling-og-sporsmal");
    expect(content?.title).toBe("Bestilling og spørsmål");
    expect(content?.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "hero" }),
        expect.objectContaining({ type: "richText" }),
        expect.objectContaining({ type: "cta" }),
      ]),
    );
    expect(content?.blocks.length).toBeGreaterThan(0);
  });

  it("renders seeded public content instead of the empty fallback when seeded body exists", async () => {
    const { PublicCmsSlugPageView } = await import("@/lib/cms/public/publicCmsSlugRoute");

    const node = await PublicCmsSlugPageView({
      slug: "bestilling-og-sporsmal",
      searchParams: Promise.resolve({}),
    });

    const html = renderToStaticMarkup(node);

    expect(html).toContain("Bestilling og spørsmål");
    expect(html).toContain("Vanlige spørsmål om bestilling");
    expect(html).toContain("Ofte stilte spørsmål");
    expect(html).not.toContain("Ingen innhold å vise.");
  });
});

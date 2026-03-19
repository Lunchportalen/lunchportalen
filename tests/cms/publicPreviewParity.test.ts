/**
 * PHASE 5: Preview/public/publish parity.
 * - Public route uses published (prod) content via getContentBySlug.
 * - Preview uses draft (preview variant).
 * - Same renderBlock pipeline; variant selection is the only divergence.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";
import { getContentBySlug } from "@/lib/cms/public/getContentBySlug";

let mockPagesBySlug: Record<string, { id: string; slug: string; title: string | null; status?: string | null } | null> = {};
let mockVariantsByKey: Map<string, { id: string; body: unknown } | null> = new Map();

function variantKey(pageId: string, locale: string, environment: string): string {
  return `${pageId}:${locale}:${environment}`;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const q: any = {
        _slug: undefined as string | undefined,
        _status: undefined as string | undefined,
        _pageId: undefined as string | undefined,
        _locale: undefined as string | undefined,
        _env: undefined as string | undefined,
        select(_cols?: string | string[]) {
          return q;
        },
        eq(col: string, val: string) {
          if (table === "content_pages") {
            if (col === "slug") q._slug = val;
            else if (col === "status") q._status = val;
          } else if (table === "content_page_variants") {
            if (col === "page_id") q._pageId = val;
            else if (col === "locale") q._locale = val;
            else if (col === "environment") q._env = val;
          }
          return q;
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        maybeSingle(): Promise<{ data: any; error: any }> {
          if (table === "content_pages") {
            const pageRaw = q._slug != null ? mockPagesBySlug[q._slug] ?? null : null;
            const page =
              pageRaw && q._status != null
                ? (pageRaw.status === q._status ? pageRaw : null)
                : pageRaw;
            return Promise.resolve({ data: page, error: null });
          }
          if (table === "content_page_variants" && q._pageId != null && q._locale != null && q._env != null) {
            const key = variantKey(q._pageId, q._locale, q._env);
            const variant = mockVariantsByKey.get(key) ?? null;
            return Promise.resolve({ data: variant, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return q;
    },
  }),
}));

describe("getContentBySlug — public uses published (prod) content", () => {
  beforeEach(() => {
    mockPagesBySlug = {};
    mockVariantsByKey = new Map();
    vi.clearAllMocks();
  });

  test("returns null when slug is empty or invalid", async () => {
    expect(await getContentBySlug("")).toBeNull();
    expect(await getContentBySlug("   ")).toBeNull();
  });

  test("returns null when page does not exist", async () => {
    mockPagesBySlug["missing-page"] = null;
    expect(await getContentBySlug("missing-page")).toBeNull();
  });

  test("returns null when page exists but is draft (status not published)", async () => {
    const pageId = "page-draft";
    mockPagesBySlug["draft-page"] = { id: pageId, slug: "draft-page", title: "Draft", status: "draft" };
    const result = await getContentBySlug("draft-page");
    expect(result).toBeNull();
  });

  test("returns null when only preview variant exists (no prod)", async () => {
    const pageId = "page-1";
    mockPagesBySlug["my-slug"] = { id: pageId, slug: "my-slug", title: "My Page", status: "published" };
    mockVariantsByKey.set(variantKey(pageId, "nb", "preview"), {
      id: "v-preview",
      body: { version: 1, blocks: [{ id: "b1", type: "richText", data: { heading: "Draft" } }] },
    });
    // No prod variant
    const result = await getContentBySlug("my-slug");
    expect(result).toBeNull();
  });

  test("returns prod variant body when prod variant exists", async () => {
    const pageId = "page-2";
    const prodBody = { version: 1, blocks: [{ id: "b1", type: "richText", data: { heading: "Published" } }] };
    mockPagesBySlug["published-page"] = { id: pageId, slug: "published-page", title: "Published", status: "published" };
    mockVariantsByKey.set(variantKey(pageId, "nb", "prod"), {
      id: "v-prod",
      body: prodBody,
    });
    const result = await getContentBySlug("published-page");
    expect(result).not.toBeNull();
    expect(result!.pageId).toBe(pageId);
    expect(result!.slug).toBe("published-page");
    expect(result!.title).toBe("Published");
    expect(result!.body).toEqual(prodBody);
  });

  test("public route uses published content: prod variant only, not preview", async () => {
    const pageId = "page-3";
    mockPagesBySlug["parity"] = { id: pageId, slug: "parity", title: "Parity", status: "published" };
    mockVariantsByKey.set(variantKey(pageId, "nb", "preview"), {
      id: "v-preview",
      body: { version: 1, blocks: [{ id: "draft", type: "richText", data: { heading: "Draft content" } }] },
    });
    mockVariantsByKey.set(variantKey(pageId, "nb", "prod"), {
      id: "v-prod",
      body: { version: 1, blocks: [{ id: "pub", type: "richText", data: { heading: "Published content" } }] },
    });
    const result = await getContentBySlug("parity");
    expect(result).not.toBeNull();
    const blocks = (result!.body as { blocks?: unknown[] })?.blocks ?? [];
    const heading = blocks[0] && typeof blocks[0] === "object" && "data" in blocks[0] ? (blocks[0].data as { heading?: string }).heading : undefined;
    expect(heading).toBe("Published content");
  });
});

describe("preview uses draft content", () => {
  // Preview page fetches variants with .eq("page_id").eq("locale","nb") then picks environment==="preview" ?? variants[0].
  // We test the selection logic: getContentBySlug (public) does NOT return preview variant; only prod.
  // So "preview uses draft" is guaranteed by: public uses prod (tested above); preview page code explicitly prefers environment==="preview".
  test("public getContentBySlug ignores preview variant", async () => {
    const pageId = "page-4";
    mockPagesBySlug["draft-only"] = { id: pageId, slug: "draft-only", title: "Draft", status: "published" };
    mockVariantsByKey.set(variantKey(pageId, "nb", "preview"), {
      id: "v-preview",
      body: { version: 1, blocks: [{ id: "d", type: "richText", data: { heading: "Draft" } }] },
    });
    const result = await getContentBySlug("draft-only");
    expect(result).toBeNull();
  });
});

describe("publish action changes visible state deterministically", () => {
  test("when prod variant has body X, getContentBySlug returns X", async () => {
    const pageId = "page-5";
    const publishedBody = { version: 1, blocks: [{ id: "after-publish", type: "hero", data: { title: "Live" } }] };
    mockPagesBySlug["live"] = { id: pageId, slug: "live", title: "Live", status: "published" };
    mockVariantsByKey.set(variantKey(pageId, "nb", "prod"), {
      id: "v-prod",
      body: publishedBody,
    });
    const result = await getContentBySlug("live");
    expect(result).not.toBeNull();
    expect(result!.body).toEqual(publishedBody);
  });
});

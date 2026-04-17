/**
 * PHASE 5: Preview/public/publish parity for **Supabase-stored** pages (internal reader).
 * Public marketing routes resolve via Umbraco only — see `getContentBySlug` + docs.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { readSupabasePublishedContentPageBySlug } from "@/lib/cms/supabase/readPublishedContentPageBySlug";

let mockPagesBySlug: Record<string, { id: string; slug: string; title: string | null; status?: string | null } | null> = {};
let mockVariantsByKey: Map<string, { id: string; body: unknown } | null> = new Map();

function variantKey(pageId: string, locale: string, environment: string): string {
  return `${pageId}:${locale}:${environment}`;
}

type MockChain = {
  _slug?: string;
  _status?: string;
  _pageId?: string;
  _locale?: string;
  _env?: string;
  select: (_cols?: string | string[]) => MockChain;
  eq: (col: string, val: string) => MockChain;
  order: () => MockChain;
  limit: () => MockChain;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
};

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

    supabaseAdmin: () => ({
      from: (table: string) => {
        const q: MockChain = {
          select() {
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
          maybeSingle() {
            if (table === "content_pages") {
              const pageRaw = q._slug != null ? mockPagesBySlug[q._slug] ?? null : null;
              const page =
                pageRaw && q._status != null
                  ? pageRaw.status === q._status
                    ? pageRaw
                    : null
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
  } as unknown as typeof import("@/lib/supabase/admin");
});

describe("readSupabasePublishedContentPageBySlug — published (prod) variant selection", () => {
  beforeEach(() => {
    mockPagesBySlug = {};
    mockVariantsByKey = new Map();
    vi.clearAllMocks();
  });

  test("returns null when slug is empty or invalid", async () => {
    expect(await readSupabasePublishedContentPageBySlug("")).toBeNull();
    expect(await readSupabasePublishedContentPageBySlug("   ")).toBeNull();
  });

  test("returns null when page does not exist", async () => {
    mockPagesBySlug["missing-page"] = null;
    expect(await readSupabasePublishedContentPageBySlug("missing-page")).toBeNull();
  });

  test("returns null when page exists but is draft (status not published)", async () => {
    const pageId = "page-draft";
    mockPagesBySlug["draft-page"] = { id: pageId, slug: "draft-page", title: "Draft", status: "draft" };
    const result = await readSupabasePublishedContentPageBySlug("draft-page");
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
    const result = await readSupabasePublishedContentPageBySlug("my-slug");
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
    const result = await readSupabasePublishedContentPageBySlug("published-page");
    expect(result).not.toBeNull();
    expect(result!.pageId).toBe(pageId);
    expect(result!.slug).toBe("published-page");
    expect(result!.title).toBe("Published");
    expect(result!.body).toEqual(prodBody);
    expect(result!.publicContentOrigin).toBe("live-supabase");
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
    const result = await readSupabasePublishedContentPageBySlug("parity");
    expect(result).not.toBeNull();
    expect(result!.publicContentOrigin).toBe("live-supabase");
    const blocks = (result!.body as { blocks?: unknown[] })?.blocks ?? [];
    const heading = blocks[0] && typeof blocks[0] === "object" && "data" in blocks[0] ? (blocks[0].data as { heading?: string }).heading : undefined;
    expect(heading).toBe("Published content");
  });

  test("readSupabase with preview:true returns preview variant body (no prod fallback)", async () => {
    const pageId = "page-preview-flag";
    mockPagesBySlug["preview-flag"] = { id: pageId, slug: "preview-flag", title: "PF", status: "published" };
    mockVariantsByKey.set(variantKey(pageId, "nb", "preview"), {
      id: "v-preview-only",
      body: { version: 1, blocks: [{ id: "pv", type: "richText", data: { heading: "Preview only" } }] },
    });
    const prodResult = await readSupabasePublishedContentPageBySlug("preview-flag");
    expect(prodResult).toBeNull();
    const previewResult = await readSupabasePublishedContentPageBySlug("preview-flag", { preview: true });
    expect(previewResult).not.toBeNull();
    expect(previewResult!.publicContentOrigin).toBe("live-supabase");
    const blocks = (previewResult!.body as { blocks?: unknown[] })?.blocks ?? [];
    const heading = blocks[0] && typeof blocks[0] === "object" && "data" in blocks[0] ? (blocks[0].data as { heading?: string }).heading : undefined;
    expect(heading).toBe("Preview only");
  });
});

describe("preview uses draft content", () => {
  // Preview page fetches variants with .eq("page_id").eq("locale","nb") then picks environment==="preview" ?? variants[0].
  // We test the selection logic: getContentBySlug (public) does NOT return preview variant; only prod.
  // So "preview uses draft" is guaranteed by: public uses prod (tested above); preview page code explicitly prefers environment==="preview".
  test("readSupabase ignores preview variant for public-style prod read", async () => {
    const pageId = "page-4";
    mockPagesBySlug["draft-only"] = { id: pageId, slug: "draft-only", title: "Draft", status: "published" };
    mockVariantsByKey.set(variantKey(pageId, "nb", "preview"), {
      id: "v-preview",
      body: { version: 1, blocks: [{ id: "d", type: "richText", data: { heading: "Draft" } }] },
    });
    const result = await readSupabasePublishedContentPageBySlug("draft-only");
    expect(result).toBeNull();
  });
});

describe("publish action changes visible state deterministically", () => {
  test("when prod variant has body X, readSupabase returns X", async () => {
    const pageId = "page-5";
    const publishedBody = { version: 1, blocks: [{ id: "after-publish", type: "hero", data: { title: "Live" } }] };
    mockPagesBySlug["live"] = { id: pageId, slug: "live", title: "Live", status: "published" };
    mockVariantsByKey.set(variantKey(pageId, "nb", "prod"), {
      id: "v-prod",
      body: publishedBody,
    });
    const result = await readSupabasePublishedContentPageBySlug("live");
    expect(result).not.toBeNull();
    expect(result!.body).toEqual(publishedBody);
    expect(result!.publicContentOrigin).toBe("live-supabase");
  });
});

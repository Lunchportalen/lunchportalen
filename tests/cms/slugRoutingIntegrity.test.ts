/**
 * CMS → Public slug/routing integrity guarantees.
 *
 * Focus:
 * - Slug normalization (case-insensitive URL vs stored lowercase slug)
 * - Loader error paths failing closed (no arbitrary content on error)
 * - Variant lookup errors also failing closed
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";
import { getContentBySlug } from "@/lib/cms/public/getContentBySlug";

type Page = { id: string; slug: string; title: string | null } | null;
type Variant = { id: string; body: unknown } | null;

let mockPagesBySlug: Record<string, Page> = {};
let mockVariantsByKey: Map<string, Variant> = new Map();
let forcePageError = false;
let forceVariantError = false;

function variantKey(pageId: string, locale: string, environment: string): string {
  return `${pageId}:${locale}:${environment}`;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const q: any = {
        _slug: undefined as string | undefined,
        _pageId: undefined as string | undefined,
        _locale: undefined as string | undefined,
        _env: undefined as string | undefined,
        select(_cols?: string | string[]) {
          return q;
        },
        eq(col: string, val: string) {
          if (table === "content_pages") {
            if (col === "slug") q._slug = val;
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
            if (forcePageError) {
              return Promise.resolve({ data: null, error: new Error("page lookup error") });
            }
            const page = q._slug != null ? mockPagesBySlug[q._slug] ?? null : null;
            return Promise.resolve({ data: page, error: null });
          }
          if (table === "content_page_variants" && q._pageId != null && q._locale != null && q._env != null) {
            if (forceVariantError) {
              return Promise.resolve({ data: null, error: new Error("variant lookup error") });
            }
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

describe("getContentBySlug — slug normalization and routing integrity", () => {
  beforeEach(() => {
    mockPagesBySlug = {};
    mockVariantsByKey = new Map();
    forcePageError = false;
    forceVariantError = false;
    vi.clearAllMocks();
  });

  test("normalizes incoming slug to lowercase for lookup while preserving stored slug", async () => {
    const pageId = "page-1";
    mockPagesBySlug["my-slug"] = { id: pageId, slug: "my-slug", title: "My Page" };
    const body = { version: 1, blocks: [{ id: "b1", type: "richText", data: { heading: "Published" } }] };
    mockVariantsByKey.set(variantKey(pageId, "nb", "prod"), { id: "v-prod", body });

    const result = await getContentBySlug("My-Slug");
    expect(result).not.toBeNull();
    expect(result!.pageId).toBe(pageId);
    // Slug from DB is preserved; lookup was still successful despite mixed-case URL.
    expect(result!.slug).toBe("my-slug");
  });

  test("fails closed (returns null) when page lookup returns an error", async () => {
    forcePageError = true;
    const result = await getContentBySlug("any-slug");
    expect(result).toBeNull();
  });

  test("fails closed (returns null) when variant lookup returns an error", async () => {
    const pageId = "page-2";
    mockPagesBySlug["error-variant"] = { id: pageId, slug: "error-variant", title: "Page" };
    // No need to add variant; we force a variant error instead.
    forceVariantError = true;

    const result = await getContentBySlug("error-variant");
    expect(result).toBeNull();
  });
});


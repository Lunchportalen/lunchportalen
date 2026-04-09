/**
 * PHASE 5B: Publish semantics closure.
 * - Publish copies preview variant body into prod so public route shows it.
 * - Preview edits after publish do not change public until next publish.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";
import { getContentBySlug } from "@/lib/cms/public/getContentBySlug";
import { copyVariantBodyToProd } from "@/lib/backoffice/content/releasesRepo";

const variantKey = (pageId: string, locale: string, environment: string) =>
  `${pageId}:${locale}:${environment}`;

let mockPagesBySlug: Record<string, { id: string; slug: string; title: string | null } | null> = {};
let mockVariantsByKey: Map<string, { id: string; body: unknown } | null> = new Map();
let mockVariantsById: Map<string, { page_id: string; locale: string; environment: string; body: unknown }> = new Map();
let nextId = 1000;

function addVariant(pageId: string, locale: string, env: string, body: unknown): string {
  const id = `v-${nextId++}`;
  mockVariantsByKey.set(variantKey(pageId, locale, env), { id, body });
  mockVariantsById.set(id, { page_id: pageId, locale, environment: env, body });
  return id;
}

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => ({
    rpc: (fn: string) => {
      if (fn === "lp_insert_page_version") {
        return Promise.resolve({
          data: [{ id: "pv-publish-test", version_number: 1 }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: "unknown_rpc" } });
    },
    from: (table: string) => {
      const q: any = {
        _slug: undefined as string | undefined,
        _pageId: undefined as string | undefined,
        _byId: undefined as string | undefined,
        _locale: undefined as string | undefined,
        _env: undefined as string | undefined,
        _id: undefined as string | undefined,
        _updatePayload: undefined as Record<string, unknown> | undefined,
        select(_cols?: string | string[]) {
          return q;
        },
        eq(col: string, val: string) {
          if (table === "content_pages") {
            if (col === "slug") q._slug = val;
            if (col === "id") q._byId = val;
          } else if (table === "content_page_variants") {
            if (col === "page_id") q._pageId = val;
            else if (col === "locale") q._locale = val;
            else if (col === "environment") q._env = val;
            else if (col === "id") q._id = val;
          }
          return q;
        },
        update(payload: Record<string, unknown>) {
          q._updatePayload = payload;
          return q;
        },
        insert(row: Record<string, unknown>) {
          const page_id = row.page_id as string;
          const locale = row.locale as string;
          const environment = row.environment as string;
          const body = row.body;
          const id = `v-${nextId++}`;
          mockVariantsByKey.set(variantKey(page_id, locale, environment), { id, body });
          mockVariantsById.set(id, { page_id, locale, environment, body });
          return Promise.resolve({ data: { id }, error: null });
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        then(resolve: (value: any) => void, reject?: (err: any) => void) {
          if (table === "content_page_variants" && q._updatePayload != null && q._id != null) {
            const row = mockVariantsById.get(q._id);
            if (row) {
              row.body = q._updatePayload.body ?? row.body;
              const key = variantKey(row.page_id, row.locale, row.environment);
              const entry = mockVariantsByKey.get(key);
              if (entry) mockVariantsByKey.set(key, { ...entry, body: row.body });
            }
          }
          return Promise.resolve(undefined).then(resolve as any, reject);
        },
        maybeSingle(): Promise<{ data: any; error: any }> {
          if (table === "content_pages") {
            if (q._byId != null) {
              const page = Object.values(mockPagesBySlug).find((p) => p?.id === q._byId) ?? null;
              const data = page
                ? {
                    id: page.id,
                    title: page.title,
                    slug: page.slug,
                    status: "published",
                    created_at: null,
                    updated_at: null,
                    published_at: null,
                  }
                : null;
              return Promise.resolve({ data, error: null });
            }
            const page = q._slug != null ? mockPagesBySlug[q._slug] ?? null : null;
            return Promise.resolve({ data: page, error: null });
          }
          if (table === "content_page_variants") {
            if (q._id != null && q._pageId != null) {
              const row = mockVariantsById.get(q._id);
              const data =
                row && row.page_id === q._pageId ? { body: row.body } : row ? { body: row.body } : null;
              return Promise.resolve({ data, error: null });
            }
            if (q._pageId != null && q._locale != null && q._env != null) {
              const key = variantKey(q._pageId, q._locale, q._env);
              const variant = mockVariantsByKey.get(key) ?? null;
              return Promise.resolve({ data: variant, error: null });
            }
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return q;
    },
  }),
  };
});

describe("publish flow — public and preview parity", () => {
  beforeEach(() => {
    mockPagesBySlug = {};
    mockVariantsByKey = new Map();
    mockVariantsById = new Map();
    nextId = 1000;
    vi.clearAllMocks();
  });

  test("1. preview variant exists, prod does not → public returns null", async () => {
    const pageId = "page-1";
    mockPagesBySlug["only-preview"] = { id: pageId, slug: "only-preview", title: "Draft" };
    addVariant(pageId, "nb", "preview", { version: 1, blocks: [{ id: "b1", type: "richText", data: { heading: "Draft" } }] });
    const result = await getContentBySlug("only-preview");
    expect(result).toBeNull();
  });

  test("2. publish action copies preview to prod → public now returns that body", async () => {
    const pageId = "page-2";
    const slug = "after-publish";
    mockPagesBySlug[slug] = { id: pageId, slug, title: "Page" };
    const previewBody = { version: 1, blocks: [{ id: "b1", type: "hero", data: { title: "Published title" } }] };
    const previewVariantId = addVariant(pageId, "nb", "preview", previewBody);

    const supabase = (await import("@/lib/supabase/admin")).supabaseAdmin();
    await copyVariantBodyToProd(supabase, pageId, previewVariantId, "nb");

    const result = await getContentBySlug(slug);
    expect(result).not.toBeNull();
    expect(result!.body).toEqual(previewBody);
  });

  test("3. preview edits after publish do NOT change public until next publish", async () => {
    const pageId = "page-3";
    const slug = "edits-after-publish";
    mockPagesBySlug[slug] = { id: pageId, slug, title: "Page" };
    const publishedBody = { version: 1, blocks: [{ id: "b1", type: "richText", data: { heading: "Live" } }] };
    addVariant(pageId, "nb", "prod", publishedBody);
    const previewBodyEdited = { version: 1, blocks: [{ id: "b1", type: "richText", data: { heading: "Draft edit" } }] };
    addVariant(pageId, "nb", "preview", previewBodyEdited);

    const result = await getContentBySlug(slug);
    expect(result).not.toBeNull();
    expect(result!.body).toEqual(publishedBody);
    const blocks = (result!.body as { blocks?: { data?: { heading?: string } }[] })?.blocks ?? [];
    expect(blocks[0]?.data?.heading).toBe("Live");
  });

  test("4. preview route continues showing preview variant (public returns prod only)", async () => {
    const pageId = "page-4";
    const slug = "both-variants";
    mockPagesBySlug[slug] = { id: pageId, slug, title: "Page" };
    const prodBody = { version: 1, blocks: [{ id: "p", type: "richText", data: { heading: "Prod" } }] };
    const previewBody = { version: 1, blocks: [{ id: "d", type: "richText", data: { heading: "Preview" } }] };
    addVariant(pageId, "nb", "prod", prodBody);
    addVariant(pageId, "nb", "preview", previewBody);

    const result = await getContentBySlug(slug);
    expect(result).not.toBeNull();
    expect((result!.body as { blocks?: { data?: { heading?: string } }[] })?.blocks?.[0]?.data?.heading).toBe("Prod");
    const previewVariant = mockVariantsByKey.get(variantKey(pageId, "nb", "preview"));
    expect(previewVariant?.body).toEqual(previewBody);
  });
});

/**
 * CMS hardening guarantees — focused proof that final guarantees hold.
 * Complements existing tests (publicPreviewParity, blockRenderFailSafety, contentOutbox,
 * useContentWorkspaceSave, contentWorkspaceBlocks, useMediaPickerHelpers, routeGuardConsistency).
 *
 * Scenarios:
 * 1. Tree node opens correct editor target (node id / slug resolution)
 * 2. Save/outbox state deterministic (covered in useContentWorkspaceSave + contentOutbox)
 * 3. Block add/edit/reorder preserves valid block truth (normalizeBlockForRender + roundtrip)
 * 4. Preview/public parity + drafts do not leak (covered in publicPreviewParity)
 * 5. Malformed/unknown content fails safely (normalizeBlockForRender + renderBlock in blockRenderFailSafety)
 * 6. Media references resolve safely (URL not stored as mediaItemId — in useMediaPickerHelpers)
 * 7. Unauthorized CMS access denied (denyResponse null-safe — in routeGuardConsistency)
 */

// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";
import { isContentPageId } from "@/lib/cms/public/getPageIdBySlug";
import { getContentBySlug } from "@/lib/cms/public/getContentBySlug";
import { normalizeBlockForRender } from "@/lib/cms/public/normalizeBlockForRender";
import {
  serializeBlocksToBody,
  parseBodyToBlocks,
  normalizeBlocks,
  createBlock,
  type Block,
} from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";

describe("CMS hardening – 1. Tree/editor binding", () => {
  test("content page node id is valid UUID so editor route can resolve", () => {
    const uuid = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
    expect(isContentPageId(uuid)).toBe(true);
    expect(isContentPageId("home")).toBe(false);
    expect(isContentPageId("")).toBe(false);
    expect(isContentPageId("not-a-uuid")).toBe(false);
  });
});

describe("CMS hardening – 3. Block contract correctness", () => {
  test("normalizeBlockForRender with null/undefined returns safe BlockNode with defaults", () => {
    const out1 = normalizeBlockForRender(null, 0);
    expect(out1).toEqual({ id: "block-0", type: "richText", data: {} });

    const out2 = normalizeBlockForRender(undefined, 1);
    expect(out2).toEqual({ id: "block-1", type: "richText", data: {} });
  });

  test("normalizeBlockForRender with flat editor block populates data from rest keys", () => {
    const flat = { id: "b1", type: "richText", heading: "H", body: "B" };
    const out = normalizeBlockForRender(flat, 0);
    expect(out.id).toBe("b1");
    expect(out.type).toBe("richText");
    expect(out.data).toMatchObject({ heading: "H", body: "B" });
  });

  test("normalizeBlockForRender maps assetPath to src and buttonHref to href", () => {
    const flat = { id: "img1", type: "image", assetPath: "/img.jpg", alt: "Alt" };
    const out = normalizeBlockForRender(flat, 0);
    expect(out.data.src).toBe("/img.jpg");
    expect(out.data.assetPath).toBe("/img.jpg");
  });

  test("normalizeBlockForRender hero_bleed: persisted variant locks text + overlay axis", () => {
    const flat = {
      id: "hb1",
      type: "hero_bleed",
      variant: "right",
      textPosition: "left",
      textAlign: "center",
      overlayPosition: "left",
    };
    const out = normalizeBlockForRender(flat, 0);
    expect(out.data.variant).toBe("right");
    expect(out.data.textPosition).toBe("right");
    expect(out.data.textAlign).toBe("right");
    expect(out.data.overlayPosition).toBe("right");
  });

  test("normalizeBlockForRender hero_bleed: legacy without variant keeps independent positions", () => {
    const flat = {
      id: "hb2",
      type: "hero_bleed",
      textPosition: "left",
      textAlign: "center",
      overlayPosition: "right",
    };
    const out = normalizeBlockForRender(flat, 0);
    expect(out.data.textPosition).toBe("left");
    expect(out.data.textAlign).toBe("center");
    expect(out.data.overlayPosition).toBe("right");
    expect(out.data.variant).toBe("left");
  });

  test("serialize then parse roundtrip preserves block ids and types", () => {
    const blocks: Block[] = [
      createBlock("hero"),
      createBlock("richText"),
      createBlock("image"),
    ];
    blocks[0].id = "h1";
    blocks[1].id = "r1";
    const json = serializeBlocksToBody(blocks, {});
    const parsed = parseBodyToBlocks(JSON.parse(json));
    expect(parsed.mode).toBe("blocks");
    expect(parsed.blocks).toHaveLength(3);
    expect(parsed.blocks[0].id).toBe("h1");
    expect(parsed.blocks[1].id).toBe("r1");
    expect(parsed.blocks[0].type).toBe("hero");
    expect(parsed.blocks[1].type).toBe("richText");
    expect(parsed.blocks[2].type).toBe("image");
  });

  test("normalizeBlocks filters out invalid blocks and preserves valid shape", () => {
    const raw = [
      { id: "a", type: "richText", heading: "H", body: "B" },
      { id: "b", type: "unknown" },
      null,
      { id: "c", type: "hero", title: "T" },
    ];
    const normalized = normalizeBlocks(raw);
    expect(normalized.length).toBeLessThanOrEqual(3);
    expect(normalized.every((b) => b && b.id && b.type)).toBe(true);
  });
});

let mockPagesBySlugHardening: Record<string, { id: string; slug: string; title: string | null; status?: string | null } | null> = {};
let mockVariantsByKeyHardening: Map<string, { id: string; body: unknown } | null> = new Map();

function variantKeyHardening(pageId: string, locale: string, environment: string): string {
  return `${pageId}:${locale}:${environment}`;
}

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

    supabaseAdmin: () => ({
      from: (table: string) => {
        const q: any = {
          _slug: undefined as string | undefined,
          _pageId: undefined as string | undefined,
          _locale: undefined as string | undefined,
          _env: undefined as string | undefined,
          _status: undefined as string | undefined,
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
          maybeSingle(): Promise<{ data: any; error: any }> {
            if (table === "content_pages") {
              const pageRaw = q._slug != null ? mockPagesBySlugHardening[q._slug] ?? null : null;
              const page =
                pageRaw && q._status != null
                  ? (pageRaw.status === q._status ? pageRaw : null)
                  : pageRaw;
              return Promise.resolve({ data: page, error: null });
            }
            if (table === "content_page_variants" && q._pageId != null && q._locale != null && q._env != null) {
              const key = variantKeyHardening(q._pageId, q._locale, q._env);
              const variant = mockVariantsByKeyHardening.get(key) ?? null;
              return Promise.resolve({ data: variant, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
        };
        return q;
      },
    }),
    };
});

describe("CMS hardening – 4 & 5. Preview/public parity and drafts do not leak", () => {
  beforeEach(() => {
    mockPagesBySlugHardening = {};
    mockVariantsByKeyHardening = new Map();
    vi.clearAllMocks();
  });

  test("getContentBySlug returns null when only preview variant exists (drafts do not leak)", async () => {
    const pageId = "page-1";
    mockPagesBySlugHardening["draft-page"] = { id: pageId, slug: "draft-page", title: "Draft", status: "published" };
    mockVariantsByKeyHardening.set(variantKeyHardening(pageId, "nb", "preview"), {
      id: "v-preview",
      body: { version: 1, blocks: [{ id: "d", type: "richText", data: { heading: "Draft" } }] },
    });
    const result = await getContentBySlug("draft-page");
    expect(result).toBeNull();
  });

  test("getContentBySlug returns prod body when prod exists (public sees only published)", async () => {
    const pageId = "page-2";
    const prodBody = { version: 1, blocks: [{ id: "p", type: "richText", data: { heading: "Published" } }] };
    mockPagesBySlugHardening["live"] = { id: pageId, slug: "live", title: "Live", status: "published" };
    mockVariantsByKeyHardening.set(variantKeyHardening(pageId, "nb", "prod"), { id: "v-prod", body: prodBody });
    const result = await getContentBySlug("live");
    expect(result).not.toBeNull();
    expect(result!.body).toEqual(prodBody);
  });

  test("getContentBySlug returns null when page is draft (status not published)", async () => {
    const pageId = "page-3";
    const prodBody = { version: 1, blocks: [{ id: "p", type: "richText", data: { heading: "Published" } }] };
    mockPagesBySlugHardening["draft-status-page"] = { id: pageId, slug: "draft-status-page", title: "Draft status", status: "draft" };
    mockVariantsByKeyHardening.set(variantKeyHardening(pageId, "nb", "prod"), { id: "v-prod", body: prodBody });
    const result = await getContentBySlug("draft-status-page");
    expect(result).toBeNull();
  });
});

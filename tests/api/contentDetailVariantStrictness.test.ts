import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

function mkReq(url: string, init?: RequestInit) {
  return new Request(url, init) as import("next/server").NextRequest;
}

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const requireRoleOr403Mock = vi.hoisted(() => vi.fn());

let remotePageRow: Record<string, unknown> | null = null;
let remoteVariantRow: Record<string, unknown> | null = null;
let previewPageRow: Record<string, unknown> | null = null;
let previewVariantRow: Record<string, unknown> | null = null;

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
  q: (request: Request, key: string) => new URL(request.url).searchParams.get(key),
}));

vi.mock("@/lib/supabase/admin", async () => {
  return {
    hasSupabaseAdminConfig: () => false,
    supabaseAdmin: (() =>
      ({
        from: (table: string) => {
          if (table === "content_pages") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: remotePageRow, error: null }),
                }),
              }),
            };
          }
          if (table === "content_page_variants") {
            const query: Record<string, string> = {};
            return {
              select: () => ({
                eq(column: string, value: string) {
                  query[column] = value;
                  return this;
                },
                maybeSingle: async () => ({
                  data:
                    query.page_id && query.locale && query.environment ? remoteVariantRow : null,
                  error: null,
                }),
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      })) as any,
  };
});

vi.mock("@/components/PageShell", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "page-shell" }, children),
}));

vi.mock("@/components/cms/CmsBlockRenderer", () => ({
  CmsBlockRenderer: ({ blocks }: { blocks: unknown[] }) =>
    React.createElement("div", { "data-testid": "cms-block-renderer" }, String(blocks.length)),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: (table: string) => {
      if (table === "content_pages") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: previewPageRow, error: null }),
            }),
          }),
        };
      }
      if (table === "content_page_variants") {
        return {
          select: () => ({
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: previewVariantRow, error: null }),
          }),
        };
      }
      throw new Error(`Unexpected preview table: ${table}`);
    },
  }),
}));

describe.sequential("Content detail variant strictness", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    delete process.env.LP_CMS_RUNTIME_MODE;
    delete process.env.LOCAL_DEV_CONTENT_RESERVE;
    delete process.env.LP_LOCAL_CMS_RUNTIME;

    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: "rid_variant_strict",
        scope: { role: "superadmin", userId: "user_1", email: "admin@example.com" },
      },
    });
    requireRoleOr403Mock.mockReturnValue(null);

    remotePageRow = {
      id: "page_1",
      title: "Bellissima",
      slug: "bellissima",
      status: "draft",
      created_at: "2026-04-02T00:00:00.000Z",
      updated_at: "2026-04-02T00:00:00.000Z",
      published_at: null,
    };
    remoteVariantRow = null;

    previewPageRow = { id: "page_1", title: "Bellissima", slug: "bellissima" };
    previewVariantRow = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("remote detail route returns VARIANT_NOT_FOUND instead of first fallback", async () => {
    const { GET } = await import("@/app/api/backoffice/content/pages/[id]/route");

    const res = await GET(
      mkReq("http://localhost/api/backoffice/content/pages/page_1?locale=nb&environment=preview"),
      { params: Promise.resolve({ id: "page_1" }) },
    );

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("VARIANT_NOT_FOUND");
    expect(json.detail).toMatchObject({
      pageId: "page_1",
      locale: "nb",
      environment: "preview",
    });
  });

  test("local provider detail throws VARIANT_NOT_FOUND instead of falling back to another variant", async () => {
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "local_provider");

    const cmsProvider = await import("@/lib/localRuntime/cmsProvider");
    cmsProvider.resetLocalCmsRuntimeStoreForTests();

    const created = cmsProvider.createLocalCmsPage({
      title: "Kun prod",
      slug: "kun-prod",
      locale: "nb",
      environment: "prod",
    });

    let caught: unknown = null;
    try {
      cmsProvider.getLocalCmsPageDetail({
        pageId: created.page.id,
        locale: "nb",
        environment: "preview",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ code: "VARIANT_NOT_FOUND" });
  });

  test("preview page renders an explicit missing preview-variant message", async () => {
    const pageModule = await import("@/app/(backoffice)/backoffice/preview/[id]/page");
    const element = await pageModule.default({ params: Promise.resolve({ id: "page_1" }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("mangler preview-variant");
    expect(html).toContain("Bellissima");
  });
});

/**
 * Backoffice AI image routes:
 * - /api/backoffice/ai/image-generator
 * - /api/backoffice/ai/image-metadata
 * Focus: auth/role gate, AI enabled flag, basic validation and fail-closed behavior.
 */

// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(
  url: string,
  init?: RequestInit & { headers?: Record<string, string>; body?: unknown },
) {
  const { headers = {}, body, ...rest } = init ?? {};
  const opts: RequestInit = { ...rest, headers: headers as HeadersInit };
  if (body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
    (opts as any).headers = { ...(opts.headers as any), "content-type": "application/json" };
  }
  return new Request(url, opts) as any;
}

async function readJson(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

const MOCK_RID = "rid_ai_image_routes";

const { scopeOr401Mock, requireRoleOr403Mock, isAIEnabledMock } = vi.hoisted(() => ({
  scopeOr401Mock: vi.fn(),
  requireRoleOr403Mock: vi.fn(() => null),
  isAIEnabledMock: vi.fn(() => true),
}));

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
}));

vi.mock("@/lib/ai/runner", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/ai/runner")>();
  return {
    ...mod,
    isAIEnabled: isAIEnabledMock,
  };
});

const imageGenerateBrandSafeMock = vi.fn();
vi.mock("@/lib/ai/tools/imageGenerateBrandSafe", () => ({
  imageGenerateBrandSafe: (...args: unknown[]) => imageGenerateBrandSafeMock(...args),
}));

const imageImproveMetadataToSuggestionMock = vi.fn();
vi.mock("@/lib/ai/tools/imageImproveMetadata", () => ({
  imageImproveMetadataToSuggestion: (...args: unknown[]) =>
    imageImproveMetadataToSuggestionMock(...args),
}));

const supabaseAdminMock = vi.fn(() => ({
  from: vi.fn(() => ({
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
  })),
}));
vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: (...args: unknown[]) => supabaseAdminMock(...args),
  };
});

import { POST as ImageGeneratorPOST } from "../../app/api/backoffice/ai/image-generator/route";
import { POST as ImageMetadataPOST } from "../../app/api/backoffice/ai/image-metadata/route";

describe("Backoffice AI image-generator API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAIEnabledMock.mockReturnValue(true);
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: MOCK_RID,
        route: "/api/backoffice/ai/image-generator",
        method: "POST",
        scope: { role: "superadmin", email: "test@lunchportalen.no" },
      },
    });
    requireRoleOr403Mock.mockReturnValue(null);
    imageGenerateBrandSafeMock.mockReturnValue({
      summary: "Prompt suggestions.",
      prompts: [{ prompt: "Brand-safe hero image.", alt: "hero image" }],
    });
  });

  test("returns 401 when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false }), { status: 401 }),
    });
    const res = await ImageGeneratorPOST(
      mkReq("http://localhost/api/backoffice/ai/image-generator", {
        method: "POST",
        body: { prompt: "x" },
      }),
    );
    expect(res.status).toBe(401);
  });

  test("returns 503 when AI is disabled", async () => {
    isAIEnabledMock.mockReturnValue(false);
    const res = await ImageGeneratorPOST(
      mkReq("http://localhost/api/backoffice/ai/image-generator", {
        method: "POST",
        body: { prompt: "x" },
      }),
    );
    expect(res.status).toBe(503);
    const data = await readJson(res);
    expect(data.error).toBe("FEATURE_DISABLED");
  });

  test("returns 400 when both prompt and topic+purpose are missing", async () => {
    const res = await ImageGeneratorPOST(
      mkReq("http://localhost/api/backoffice/ai/image-generator", {
        method: "POST",
        body: {},
      }),
    );
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("MISSING_INPUT");
  });

  test("returns 500 when tool returns no prompts", async () => {
    imageGenerateBrandSafeMock.mockReturnValueOnce({ summary: "none", prompts: [] });
    const res = await ImageGeneratorPOST(
      mkReq("http://localhost/api/backoffice/ai/image-generator", {
        method: "POST",
        body: { prompt: "x" },
      }),
    );
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.error).toBe("GENERATION_FAILED");
  });

  test("returns 200 with prompts when tool succeeds", async () => {
    const res = await ImageGeneratorPOST(
      mkReq("http://localhost/api/backoffice/ai/image-generator", {
        method: "POST",
        body: { prompt: "hero image" },
      }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    const payload = data.data ?? data;
    expect(Array.isArray(payload.prompts)).toBe(true);
    expect(payload.prompts.length).toBeGreaterThan(0);
    expect(typeof payload.prompts[0].prompt).toBe("string");
    expect(typeof payload.prompts[0].alt).toBe("string");
    expect(typeof payload.message).toBe("string");
  });
});

describe("Backoffice AI image-metadata API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAIEnabledMock.mockReturnValue(true);
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: MOCK_RID,
        route: "/api/backoffice/ai/image-metadata",
        method: "POST",
        scope: { role: "superadmin", email: "test@lunchportalen.no" },
      },
    });
    requireRoleOr403Mock.mockReturnValue(null);
    imageImproveMetadataToSuggestionMock.mockReturnValue({
      summary: "ok",
      suggestion: {
        alt: "Alt tekst",
        caption: "Lang bildetekst",
        tags: ["a", "b", "b", "very-long-tag-name-that-will-be-trimmed"],
      },
    });
  });

  test("returns 503 when AI is disabled", async () => {
    isAIEnabledMock.mockReturnValue(false);
    const res = await ImageMetadataPOST(
      mkReq("http://localhost/api/backoffice/ai/image-metadata", {
        method: "POST",
        body: { url: "https://example.com/x.png" },
      }),
    );
    expect(res.status).toBe(503);
    const data = await readJson(res);
    expect(data.error).toBe("FEATURE_DISABLED");
  });

  test("returns 400 when both url and mediaItemId are missing", async () => {
    const res = await ImageMetadataPOST(
      mkReq("http://localhost/api/backoffice/ai/image-metadata", {
        method: "POST",
        body: {},
      }),
    );
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("MISSING_INPUT");
  });

  test("returns 200 and normalized metadata when tool succeeds", async () => {
    const res = await ImageMetadataPOST(
      mkReq("http://localhost/api/backoffice/ai/image-metadata", {
        method: "POST",
        body: { url: "https://example.com/x.png", pageTitle: "Tittel" },
      }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    const payload = data.data ?? data;
    expect(typeof payload.alt).toBe("string");
    expect(payload.alt.length).toBeLessThanOrEqual(180);
    expect(Array.isArray(payload.tags)).toBe(true);
    expect(payload.tags.length).toBeLessThanOrEqual(8);
  });
});


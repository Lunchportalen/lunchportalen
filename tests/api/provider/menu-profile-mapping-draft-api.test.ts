/**
 * G5d.3d — Mapping draft API tests (flag-gated, provider-scoped).
 */
// @ts-nocheck

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV,
  isMenuProfileMappingDraftApiEnabled,
} from "@/lib/menu-profile/featureFlag";
import { getMenuProfile } from "@/lib/menu-profile/registry";
import { buildMenuProfileRuntimeMapping } from "@/lib/menu-profile/runtimeMapping";
import { buildProviderMenuRuntimeMappingProposal } from "@/lib/provider-menu/providerMenuRuntimeMappingProposal";

vi.mock("server-only", () => ({}));

const PROVIDER_A = "11111111-1111-1111-1111-111111111111";
const PROVIDER_B = "22222222-2222-2222-2222-222222222222";
const USER_ADMIN = "admin-user-id";
const USER_VIEWER = "viewer-user-id";

const mockGetAuthContext = vi.hoisted(() => vi.fn());
const mockGetProviderAdminContext = vi.hoisted(() => vi.fn());
const mockHasProviderRole = vi.hoisted(() => vi.fn());
const mockReadLatest = vi.hoisted(() => vi.fn());
const mockCreateDraft = vi.hoisted(() => vi.fn());
const mockArchiveDraft = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

vi.mock("@/lib/auth/providerContext", () => ({
  getProviderAdminContext: (userId: string) => mockGetProviderAdminContext(userId),
}));

vi.mock("@/lib/auth/provider", () => ({
  hasProviderRole: (...args: unknown[]) => mockHasProviderRole(...args),
}));

vi.mock("@/lib/menu-profile/runtimeMappingDraftPersistence.server", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/menu-profile/runtimeMappingDraftPersistence.server")
  >();
  const { validateRuntimeMappingDraft } = await import(
    "@/lib/menu-profile/runtimeMappingDraftValidation",
  );
  return {
    ...actual,
    readLatestRuntimeMappingDraft: (...args: unknown[]) => mockReadLatest(...args),
    createRuntimeMappingDraft: async (
      params: Parameters<typeof actual.createRuntimeMappingDraft>[0],
    ) => {
      const validation = validateRuntimeMappingDraft({
        providerId: params.providerId,
        menuProfileId: params.request.menuProfileId,
        mappingVersion: params.request.mappingVersion,
        sourceProfileVersion: params.request.sourceProfileVersion,
        draftStatus: params.request.draftStatus,
        mappingJson: params.request.mappingJson,
        unmappedCategoriesJson: params.request.unmappedCategoriesJson,
        warmDishPreviewJson: params.request.warmDishPreviewJson,
        validationSummaryJson: params.request.validationSummaryJson,
        notes: params.request.notes,
      });
      if (!validation.ok) {
        throw new actual.RuntimeMappingDraftPersistenceError(
          "validation_failed",
          validation.errors,
          "Invalid runtime mapping draft payload.",
        );
      }
      return mockCreateDraft(params);
    },
    archiveRuntimeMappingDraft: (...args: unknown[]) => mockArchiveDraft(...args),
  };
});

function buildValidPostBody(menuProfileId = "norwegian_company_lunch") {
  const profile = getMenuProfile(menuProfileId);
  const runtimeMapping = buildMenuProfileRuntimeMapping({ menuProfile: profile });
  const proposal = buildProviderMenuRuntimeMappingProposal({
    menuProfile: profile,
    runtimeMapping,
    currency: "NOK",
  });
  const unmapped = proposal.categories
    .filter((c) => c.status !== "mapped_existing_no_runtime" && c.status !== "enterprise_upgrade")
    .map((c) => c.profileCategoryKey);

  return {
    menuProfileId,
    mappingVersion: proposal.mappingVersion,
    draftStatus: "draft",
    mappingJson: { ...proposal },
    unmappedCategoriesJson: unmapped,
    warmDishPreviewJson: [...proposal.warmDishPreview],
    validationSummaryJson: { validatedAt: "2026-06-26T00:00:00.000Z", errorCount: 0 },
  };
}

function authedProvider(params: {
  userId?: string;
  providerId?: string;
  admin?: boolean;
  viewer?: boolean;
}) {
  const providerId = params.providerId ?? PROVIDER_A;
  const userId = params.userId ?? USER_ADMIN;
  mockGetAuthContext.mockResolvedValue({
    ok: true,
    user: { id: userId, email: "user@provider.no" },
  });
  mockGetProviderAdminContext.mockResolvedValue({
    primaryProvider: { id: providerId, name: "Provider", slug: "provider" },
  });
  mockHasProviderRole.mockImplementation(async (_uid: string, pid: string, role: string) => {
    if (role === "provider_viewer") return params.viewer !== false && pid === providerId;
    if (role === "provider_admin") return params.admin === true && pid === providerId;
    return false;
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

describe("LP_MENU_PROFILE_MAPPING_DRAFT_API flag", () => {
  test("defaults to false", () => {
    expect(isMenuProfileMappingDraftApiEnabled({})).toBe(false);
  });

  test("is true only for true/1", () => {
    expect(isMenuProfileMappingDraftApiEnabled({ [LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV]: "true" })).toBe(
      true,
    );
    expect(isMenuProfileMappingDraftApiEnabled({ [LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV]: "1" })).toBe(true);
    expect(isMenuProfileMappingDraftApiEnabled({ [LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV]: "false" })).toBe(
      false,
    );
  });
});

describe("GET /api/provider/menu-profile/mapping-draft", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV] = "true";
    mockReadLatest.mockResolvedValue(null);
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV];
    else process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV] = prevFlag;
  });

  test("returns 404 when flag is OFF", async () => {
    process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV] = "false";
    authedProvider({ admin: true, viewer: true });
    const { GET } = await import("@/app/api/provider/menu-profile/mapping-draft/route");
    const res = await GET({
      nextUrl: new URL(
        "http://localhost/api/provider/menu-profile/mapping-draft?menuProfileId=norwegian_company_lunch",
      ),
    } as any);
    expect(res.status).toBe(404);
    expect(mockReadLatest).not.toHaveBeenCalled();
  });

  test("anon cannot GET", async () => {
    mockGetAuthContext.mockResolvedValue({ ok: false });
    const { GET } = await import("@/app/api/provider/menu-profile/mapping-draft/route");
    const res = await GET({
      nextUrl: new URL(
        "http://localhost/api/provider/menu-profile/mapping-draft?menuProfileId=norwegian_company_lunch",
      ),
    } as any);
    expect(res.status).toBe(401);
  });

  test("user without provider access cannot GET", async () => {
    mockGetAuthContext.mockResolvedValue({ ok: true, user: { id: "emp", email: "e@x.no" } });
    mockGetProviderAdminContext.mockResolvedValue({ primaryProvider: null });
    const { GET } = await import("@/app/api/provider/menu-profile/mapping-draft/route");
    const res = await GET({
      nextUrl: new URL(
        "http://localhost/api/provider/menu-profile/mapping-draft?menuProfileId=norwegian_company_lunch",
      ),
    } as any);
    expect(res.status).toBe(403);
  });

  test("provider_viewer can GET own draft", async () => {
    authedProvider({ userId: USER_VIEWER, admin: false, viewer: true });
    mockReadLatest.mockResolvedValue({ id: "draft-1", providerId: PROVIDER_A });
    const { GET } = await import("@/app/api/provider/menu-profile/mapping-draft/route");
    const res = await GET({
      nextUrl: new URL(
        "http://localhost/api/provider/menu-profile/mapping-draft?menuProfileId=norwegian_company_lunch",
      ),
    } as any);
    expect(res.status).toBe(200);
    expect(mockReadLatest).toHaveBeenCalledWith({
      providerId: PROVIDER_A,
      menuProfileId: "norwegian_company_lunch",
    });
  });

  test("GET returns null draft when none exists", async () => {
    authedProvider({ admin: true, viewer: true });
    mockReadLatest.mockResolvedValue(null);
    const { GET } = await import("@/app/api/provider/menu-profile/mapping-draft/route");
    const res = await GET({
      nextUrl: new URL(
        "http://localhost/api/provider/menu-profile/mapping-draft?menuProfileId=norwegian_company_lunch",
      ),
    } as any);
    const json = await readJson(res);
    expect(json.data.draft).toBeNull();
  });

  test("GET uses server provider id only", async () => {
    authedProvider({ admin: true, viewer: true, providerId: PROVIDER_A });
    const { GET } = await import("@/app/api/provider/menu-profile/mapping-draft/route");
    await GET({
      nextUrl: new URL(
        "http://localhost/api/provider/menu-profile/mapping-draft?menuProfileId=norwegian_company_lunch&providerId=" +
          PROVIDER_B,
      ),
    } as any);
    expect(mockReadLatest.mock.calls[0]?.[0]?.providerId).toBe(PROVIDER_A);
  });
});

describe("POST /api/provider/menu-profile/mapping-draft", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV] = "true";
    mockCreateDraft.mockResolvedValue({
      draft: {
        id: "new-draft",
        providerId: PROVIDER_A,
        validationSummaryJson: { ok: true },
      },
      validationErrors: [],
    });
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV];
    else process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV] = prevFlag;
  });

  test("returns 404 when flag is OFF", async () => {
    process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV] = "false";
    authedProvider({ admin: true, viewer: true });
    const { POST } = await import("@/app/api/provider/menu-profile/mapping-draft/route");
    const res = await POST(
      new Request("http://localhost/api/provider/menu-profile/mapping-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildValidPostBody()),
      }) as any,
    );
    expect(res.status).toBe(404);
    expect(mockCreateDraft).not.toHaveBeenCalled();
  });

  test("provider_viewer cannot POST", async () => {
    authedProvider({ userId: USER_VIEWER, admin: false, viewer: true });
    const { POST } = await import("@/app/api/provider/menu-profile/mapping-draft/route");
    const res = await POST(
      new Request("http://localhost/api/provider/menu-profile/mapping-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildValidPostBody()),
      }) as any,
    );
    expect(res.status).toBe(403);
  });

  test("provider_admin POST writes with server provider and user", async () => {
    authedProvider({ admin: true, viewer: true });
    const { POST } = await import("@/app/api/provider/menu-profile/mapping-draft/route");
    const body = buildValidPostBody();
    const res = await POST(
      new Request("http://localhost/api/provider/menu-profile/mapping-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }) as any,
    );
    expect(res.status).toBe(200);
    expect(mockCreateDraft).toHaveBeenCalledWith({
      providerId: PROVIDER_A,
      userId: USER_ADMIN,
      request: expect.objectContaining({ menuProfileId: "norwegian_company_lunch" }),
    });
  });

  test("rejects client-supplied providerId", async () => {
    authedProvider({ admin: true, viewer: true });
    const { POST } = await import("@/app/api/provider/menu-profile/mapping-draft/route");
    const res = await POST(
      new Request("http://localhost/api/provider/menu-profile/mapping-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...buildValidPostBody(), providerId: PROVIDER_B }),
      }) as any,
    );
    expect(res.status).toBe(400);
    expect(mockCreateDraft).not.toHaveBeenCalled();
  });

  test("valid IT shadow draft POST succeeds", async () => {
    authedProvider({ admin: true, viewer: true });
    const { POST } = await import("@/app/api/provider/menu-profile/mapping-draft/route");
    const res = await POST(
      new Request("http://localhost/api/provider/menu-profile/mapping-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildValidPostBody("italian_office_lunch")),
      }) as any,
    );
    expect(res.status).toBe(200);
  });

  test("invalid runtime enablement POST returns 400", async () => {
    authedProvider({ admin: true, viewer: true });
    const body = buildValidPostBody();
    body.mappingJson = { ...(body.mappingJson as object), isRuntimeEnabled: true };
    const { POST } = await import("@/app/api/provider/menu-profile/mapping-draft/route");
    const res = await POST(
      new Request("http://localhost/api/provider/menu-profile/mapping-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }) as any,
    );
    expect(res.status).toBe(400);
    expect(mockCreateDraft).not.toHaveBeenCalled();
  });

  test("invalid menuProfileId returns 400", async () => {
    authedProvider({ admin: true, viewer: true });
    const body = buildValidPostBody();
    body.menuProfileId = "not_a_profile";
    const { POST } = await import("@/app/api/provider/menu-profile/mapping-draft/route");
    const res = await POST(
      new Request("http://localhost/api/provider/menu-profile/mapping-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }) as any,
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/provider/menu-profile/mapping-draft/archive", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV] = "true";
    mockArchiveDraft.mockResolvedValue({
      id: "draft-1",
      draftStatus: "archived",
      archivedAt: "2026-06-26T12:00:00.000Z",
    });
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV];
    else process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV] = prevFlag;
  });

  test("returns 404 when flag is OFF", async () => {
    process.env[LP_MENU_PROFILE_MAPPING_DRAFT_API_ENV] = "false";
    authedProvider({ admin: true, viewer: true });
    const { POST } = await import("@/app/api/provider/menu-profile/mapping-draft/archive/route");
    const res = await POST(
      new Request("http://localhost/api/provider/menu-profile/mapping-draft/archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftId: "draft-1" }),
      }) as any,
    );
    expect(res.status).toBe(404);
    expect(mockArchiveDraft).not.toHaveBeenCalled();
  });

  test("provider_admin can archive own draft", async () => {
    authedProvider({ admin: true, viewer: true });
    const { POST } = await import("@/app/api/provider/menu-profile/mapping-draft/archive/route");
    const res = await POST(
      new Request("http://localhost/api/provider/menu-profile/mapping-draft/archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftId: "draft-1" }),
      }) as any,
    );
    expect(res.status).toBe(200);
    expect(mockArchiveDraft).toHaveBeenCalledWith({
      providerId: PROVIDER_A,
      userId: USER_ADMIN,
      draftId: "draft-1",
    });
  });

  test("provider_viewer cannot archive", async () => {
    authedProvider({ userId: USER_VIEWER, admin: false, viewer: true });
    const { POST } = await import("@/app/api/provider/menu-profile/mapping-draft/archive/route");
    const res = await POST(
      new Request("http://localhost/api/provider/menu-profile/mapping-draft/archive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftId: "draft-1" }),
      }) as any,
    );
    expect(res.status).toBe(403);
  });
});

describe("G5d.3d runtime separation (static)", () => {
  test("mapping draft API routes do not import publish/order/week/Sanity", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const files = [
      "app/api/provider/menu-profile/mapping-draft/route.ts",
      "app/api/provider/menu-profile/mapping-draft/archive/route.ts",
      "lib/menu-profile/runtimeMappingDraftPersistence.server.ts",
    ];
    const forbidden = [/menu-publish/, /lp_order_set/, /syncMenuServiceDay/, /requireSanityWrite/];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      for (const pattern of forbidden) {
        expect(src, rel).not.toMatch(pattern);
      }
    }
  });
});

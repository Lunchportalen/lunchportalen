/**
 * G5d.4d — Publish shadow API tests (read-only, flag-gated, provider_admin only).
 */
// @ts-nocheck

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  LP_MENU_PROFILE_PUBLISH_SHADOW_ENV,
  isMenuProfilePublishShadowEnabled,
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
  return {
    ...actual,
    readLatestRuntimeMappingDraft: (...args: unknown[]) => mockReadLatest(...args),
  };
});

function buildValidPostBody(menuProfileId = "norwegian_company_lunch") {
  const profile = getMenuProfile(menuProfileId);
  const runtimeMapping = buildMenuProfileRuntimeMapping({ menuProfile: profile });
  const proposal = buildProviderMenuRuntimeMappingProposal({
    menuProfile: profile,
    runtimeMapping,
    currency:
      menuProfileId === "german_business_lunch" || menuProfileId === "italian_office_lunch"
        ? "EUR"
        : "NOK",
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
    validationSummaryJson: { validatedAt: "2026-06-27T12:00:00.000Z", errorCount: 0 },
  };
}

function buildValidDraftDto(menuProfileId = "norwegian_company_lunch", overrides: Record<string, unknown> = {}) {
  const body = buildValidPostBody(menuProfileId);
  return {
    id: "draft-shadow-1",
    providerId: PROVIDER_A,
    menuProfileId: body.menuProfileId,
    mappingVersion: body.mappingVersion,
    sourceProfileVersion: null,
    draftStatus: "draft",
    mappingJson: body.mappingJson,
    unmappedCategoriesJson: body.unmappedCategoriesJson,
    warmDishPreviewJson: body.warmDishPreviewJson,
    validationSummaryJson: body.validationSummaryJson,
    notes: null,
    createdBy: USER_ADMIN,
    updatedBy: USER_ADMIN,
    createdAt: "2026-06-27T12:00:00.000Z",
    updatedAt: "2026-06-27T12:00:00.000Z",
    archivedAt: null,
    ...overrides,
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
    if (role === "provider_viewer") return params.viewer === true && pid === providerId;
    if (role === "provider_admin") return params.admin === true && pid === providerId;
    return false;
  });
}

async function readJson(res: Response) {
  return JSON.parse(await res.text());
}

function shadowUrl(menuProfileId: string, extra = "") {
  return `http://localhost/api/provider/menu-profile/publish-shadow?menuProfileId=${menuProfileId}${extra}`;
}

describe("LP_MENU_PROFILE_PUBLISH_SHADOW flag", () => {
  test("defaults to false", () => {
    expect(isMenuProfilePublishShadowEnabled({})).toBe(false);
  });

  test("is true only for exact true", () => {
    expect(isMenuProfilePublishShadowEnabled({ [LP_MENU_PROFILE_PUBLISH_SHADOW_ENV]: "true" })).toBe(
      true,
    );
    expect(isMenuProfilePublishShadowEnabled({ [LP_MENU_PROFILE_PUBLISH_SHADOW_ENV]: "1" })).toBe(
      false,
    );
  });
});

describe("GET /api/provider/menu-profile/publish-shadow — flag", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV] = "true";
    mockReadLatest.mockResolvedValue(null);
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV];
    else process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV] = prevFlag;
  });

  test("returns 404 when flag is OFF without DB read", async () => {
    process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV] = "false";
    authedProvider({ admin: true });
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({ nextUrl: new URL(shadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(404);
    expect(mockReadLatest).not.toHaveBeenCalled();
  });

  test("flag ON reaches auth and read path", async () => {
    authedProvider({ admin: true });
    mockReadLatest.mockResolvedValue(buildValidDraftDto());
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({ nextUrl: new URL(shadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(200);
    expect(mockReadLatest).toHaveBeenCalled();
  });
});

describe("GET /api/provider/menu-profile/publish-shadow — auth", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV] = "true";
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV];
    else process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV] = prevFlag;
  });

  test("anon cannot GET", async () => {
    mockGetAuthContext.mockResolvedValue({ ok: false });
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({ nextUrl: new URL(shadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(401);
  });

  test("user without provider access cannot GET", async () => {
    mockGetAuthContext.mockResolvedValue({ ok: true, user: { id: "emp", email: "e@x.no" } });
    mockGetProviderAdminContext.mockResolvedValue({ primaryProvider: null });
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({ nextUrl: new URL(shadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(403);
  });

  test("provider_viewer cannot GET", async () => {
    authedProvider({ userId: USER_VIEWER, admin: false, viewer: true });
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({ nextUrl: new URL(shadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(403);
    expect(mockReadLatest).not.toHaveBeenCalled();
  });

  test("provider_admin can GET own shadow", async () => {
    authedProvider({ admin: true });
    mockReadLatest.mockResolvedValue(buildValidDraftDto());
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({ nextUrl: new URL(shadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(200);
    expect(mockReadLatest).toHaveBeenCalledWith({
      providerId: PROVIDER_A,
      menuProfileId: "norwegian_company_lunch",
    });
  });

  test("rejects client-supplied providerId query param", async () => {
    authedProvider({ admin: true });
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({
      nextUrl: new URL(shadowUrl("norwegian_company_lunch", "&providerId=" + PROVIDER_B)),
    } as any);
    expect(res.status).toBe(400);
    expect(mockReadLatest).not.toHaveBeenCalled();
  });

  test("GET uses server provider id only", async () => {
    authedProvider({ admin: true, providerId: PROVIDER_A });
    mockReadLatest.mockResolvedValue(buildValidDraftDto());
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    await GET({ nextUrl: new URL(shadowUrl("norwegian_company_lunch")) } as any);
    expect(mockReadLatest.mock.calls[0]?.[0]?.providerId).toBe(PROVIDER_A);
  });
});

describe("GET /api/provider/menu-profile/publish-shadow — draft read", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV] = "true";
    authedProvider({ admin: true });
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV];
    else process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV] = prevFlag;
  });

  test("returns shadow null when no draft exists", async () => {
    mockReadLatest.mockResolvedValue(null);
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({ nextUrl: new URL(shadowUrl("norwegian_company_lunch")) } as any);
    const json = await readJson(res);
    expect(res.status).toBe(200);
    expect(json.data.shadow).toBeNull();
    expect(json.data.source).toBeNull();
    expect(json.data.meta.shadowOnly).toBe(true);
  });

  test("uses latest active draft from readLatest helper", async () => {
    const draft = buildValidDraftDto();
    mockReadLatest.mockResolvedValue(draft);
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({ nextUrl: new URL(shadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(200);
    expect(mockReadLatest).toHaveBeenCalledWith({
      providerId: PROVIDER_A,
      menuProfileId: "norwegian_company_lunch",
    });
  });
});

describe("GET /api/provider/menu-profile/publish-shadow — shadow evaluation", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV] = "true";
    authedProvider({ admin: true });
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV];
    else process.env[LP_MENU_PROFILE_PUBLISH_SHADOW_ENV] = prevFlag;
  });

  test.each([
    ["norwegian_company_lunch", "NO"],
    ["italian_office_lunch", "IT"],
    ["german_business_lunch", "DE"],
  ] as const)("valid %s draft returns shadowOnly=true (%s)", async (menuProfileId) => {
    mockReadLatest.mockResolvedValue(buildValidDraftDto(menuProfileId));
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({ nextUrl: new URL(shadowUrl(menuProfileId)) } as any);
    const json = await readJson(res);
    expect(res.status).toBe(200);
    expect(json.data.shadow.shadowOnly).toBe(true);
    expect(json.data.shadow.publishImpact.runtimeWrites).toBe(0);
    expect(json.data.shadow.publishImpact.sanityWrites).toBe(0);
    expect(json.data.shadow.publishImpact.orderChanges).toBe(0);
    expect(json.data.shadow.publishImpact.weekChanges).toBe(0);
    expect(json.data.shadow.publishImpact.employeeVisibleChanges).toBe(0);
    expect(json.data.shadow.comparisonToCurrentPublish.currentPublishUnchanged).toBe(true);
    expect(json.data.meta.runtimeWrites).toBe(0);
  });

  test("response shadow has no providerId or forbidden payload fields", async () => {
    mockReadLatest.mockResolvedValue(buildValidDraftDto());
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({ nextUrl: new URL(shadowUrl("norwegian_company_lunch")) } as any);
    const json = await readJson(res);
    const forbidden = [
      "providerId",
      "apply",
      "commit",
      "publish",
      "activate",
      "enable",
      "runtimeWritePayload",
      "sanityWritePayload",
      "orderPayload",
      "weekPayload",
      "employeePayload",
    ];
    for (const field of forbidden) {
      expect(Object.keys(json.data.shadow)).not.toContain(field);
    }
  });

  test("invalid runtime-enabled draft returns 400 validation error", async () => {
    const draft = buildValidDraftDto();
    draft.mappingJson = { ...(draft.mappingJson as object), isRuntimeEnabled: true };
    mockReadLatest.mockResolvedValue(draft);
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({ nextUrl: new URL(shadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.error).toBe("VALIDATION_FAILED");
  });

  test("invalid employeeVisible draft returns 400", async () => {
    const draft = buildValidDraftDto();
    draft.mappingJson = { ...(draft.mappingJson as object), employeeVisible: true };
    mockReadLatest.mockResolvedValue(draft);
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({ nextUrl: new URL(shadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(400);
  });

  test("invalid Sanity field draft returns 400", async () => {
    const draft = buildValidDraftDto();
    draft.mappingJson = { ...(draft.mappingJson as object), sanityDocumentId: "doc-123" };
    mockReadLatest.mockResolvedValue(draft);
    const { GET } = await import("@/app/api/provider/menu-profile/publish-shadow/route");
    const res = await GET({ nextUrl: new URL(shadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(400);
  });
});

describe("G5d.4d runtime separation (static)", () => {
  test("publish-shadow API route does not import publish/order/week/Sanity/billing", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const rel = "app/api/provider/menu-profile/publish-shadow/route.ts";
    const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    const forbidden = [
      /requireSanityWrite/,
      /sanityWriteClient/,
      /menuCatalogWrite/,
      /syncMenuServiceDay/,
      /runMenuWeekRollout/,
      /lp_order_set/,
      /lp_order_advance_status/,
      /tripletex/i,
      /buildMenuDayPayload/,
    ];
    for (const pattern of forbidden) {
      expect(src, rel).not.toMatch(pattern);
    }
    expect(src).toContain("readLatestRuntimeMappingDraft");
    expect(src).toContain("buildRuntimeMappingPublishShadowEvaluation");
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  });
});

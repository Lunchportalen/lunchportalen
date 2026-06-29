/**
 * G5d.6d — Compatibility cutover API tests (read-only, flag-gated, provider_admin only).
 */
// @ts-nocheck

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV,
  isMenuProfileCompatibilityCutoverEnabled,
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
    validationSummaryJson: { validatedAt: "2026-06-28T12:00:00.000Z", errorCount: 0 },
  };
}

function buildValidDraftDto(menuProfileId = "norwegian_company_lunch", overrides: Record<string, unknown> = {}) {
  const body = buildValidPostBody(menuProfileId);
  return {
    id: "draft-compatibility-cutover-1",
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
    createdAt: "2026-06-28T12:00:00.000Z",
    updatedAt: "2026-06-28T12:00:00.000Z",
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

function compatibilityCutoverUrl(menuProfileId: string, extra = "") {
  return `http://localhost/api/provider/menu-profile/compatibility-cutover?menuProfileId=${menuProfileId}${extra}`;
}

describe("LP_MENU_PROFILE_COMPATIBILITY_CUTOVER flag", () => {
  test("defaults to false", () => {
    expect(isMenuProfileCompatibilityCutoverEnabled({})).toBe(false);
  });

  test("is true only for exact true", () => {
    expect(
      isMenuProfileCompatibilityCutoverEnabled({
        [LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV]: "true",
      }),
    ).toBe(true);
    expect(isMenuProfileCompatibilityCutoverEnabled({ [LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV]: "1" })).toBe(
      false,
    );
  });
});

describe("GET /api/provider/menu-profile/compatibility-cutover — flag", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV] = "true";
    mockReadLatest.mockResolvedValue(null);
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV];
    else process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV] = prevFlag;
  });

  test("returns 404 when flag is OFF without auth/DB/helper", async () => {
    process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV] = "false";
    authedProvider({ admin: true });
    const { GET } = await import("@/app/api/provider/menu-profile/compatibility-cutover/route");
    const res = await GET({ nextUrl: new URL(compatibilityCutoverUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(404);
    expect(mockGetAuthContext).not.toHaveBeenCalled();
    expect(mockReadLatest).not.toHaveBeenCalled();
  });

  test("flag OFF rejects anon without auth path", async () => {
    process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV] = "false";
    mockGetAuthContext.mockResolvedValue({ ok: false });
    const { GET } = await import("@/app/api/provider/menu-profile/compatibility-cutover/route");
    const res = await GET({ nextUrl: new URL(compatibilityCutoverUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(404);
    expect(mockGetAuthContext).not.toHaveBeenCalled();
  });
});

describe("GET /api/provider/menu-profile/compatibility-cutover — auth", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV] = "true";
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV];
    else process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV] = prevFlag;
  });

  test("anon with flag ON → 401", async () => {
    mockGetAuthContext.mockResolvedValue({ ok: false });
    const { GET } = await import("@/app/api/provider/menu-profile/compatibility-cutover/route");
    const res = await GET({ nextUrl: new URL(compatibilityCutoverUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(401);
  });

  test("no provider with flag ON → 403", async () => {
    mockGetAuthContext.mockResolvedValue({ ok: true, user: { id: "emp", email: "e@x.no" } });
    mockGetProviderAdminContext.mockResolvedValue({ primaryProvider: null });
    const { GET } = await import("@/app/api/provider/menu-profile/compatibility-cutover/route");
    const res = await GET({ nextUrl: new URL(compatibilityCutoverUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(403);
  });

  test("provider_viewer with flag ON → 403", async () => {
    authedProvider({ userId: USER_VIEWER, admin: false, viewer: true });
    const { GET } = await import("@/app/api/provider/menu-profile/compatibility-cutover/route");
    const res = await GET({ nextUrl: new URL(compatibilityCutoverUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(403);
    expect(mockReadLatest).not.toHaveBeenCalled();
  });

  test("provider_admin with flag ON → allowed", async () => {
    authedProvider({ admin: true });
    mockReadLatest.mockResolvedValue(buildValidDraftDto());
    const { GET } = await import("@/app/api/provider/menu-profile/compatibility-cutover/route");
    const res = await GET({ nextUrl: new URL(compatibilityCutoverUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(200);
  });

  test("rejects client-supplied providerId query param → 400", async () => {
    authedProvider({ admin: true });
    const { GET } = await import("@/app/api/provider/menu-profile/compatibility-cutover/route");
    const res = await GET({
      nextUrl: new URL(compatibilityCutoverUrl("norwegian_company_lunch", "&providerId=" + PROVIDER_B)),
    } as any);
    expect(res.status).toBe(400);
    expect(mockReadLatest).not.toHaveBeenCalled();
  });

  test("missing menuProfileId → 400", async () => {
    authedProvider({ admin: true });
    const { GET } = await import("@/app/api/provider/menu-profile/compatibility-cutover/route");
    const res = await GET({
      nextUrl: new URL("http://localhost/api/provider/menu-profile/compatibility-cutover"),
    } as any);
    expect(res.status).toBe(400);
  });

  test("GET uses server provider id only", async () => {
    authedProvider({ admin: true, providerId: PROVIDER_A });
    mockReadLatest.mockResolvedValue(buildValidDraftDto());
    const { GET } = await import("@/app/api/provider/menu-profile/compatibility-cutover/route");
    await GET({ nextUrl: new URL(compatibilityCutoverUrl("norwegian_company_lunch")) } as any);
    expect(mockReadLatest.mock.calls[0]?.[0]?.providerId).toBe(PROVIDER_A);
  });
});

describe("GET /api/provider/menu-profile/compatibility-cutover — no draft", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV] = "true";
    authedProvider({ admin: true });
    mockReadLatest.mockResolvedValue(null);
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV];
    else process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV] = prevFlag;
  });

  test("returns compatibilityCutover null and safe meta", async () => {
    const { GET } = await import("@/app/api/provider/menu-profile/compatibility-cutover/route");
    const res = await GET({ nextUrl: new URL(compatibilityCutoverUrl("norwegian_company_lunch")) } as any);
    const json = await readJson(res);
    expect(res.status).toBe(200);
    expect(json.data.compatibilityCutover).toBeNull();
    expect(json.data.source).toBeNull();
    expect(json.data.meta.compatibilityOnly).toBe(true);
    expect(json.data.meta.providerOnly).toBe(true);
    expect(json.data.meta.currentNoRuntimeUnchanged).toBeNull();
    expect(json.data.meta.employeeVisibleChanges).toBe(0);
    expect(json.data.meta.orderChanges).toBe(0);
    expect(json.data.meta.weekResponseChanges).toBe(0);
    expect(json.data.meta.publishChanges).toBe(0);
    expect(json.data.meta.sanityWrites).toBe(0);
    expect(json.data.meta.menuDayPayloadMutations).toBe(0);
    expect(json.data.meta.canProceedToRuntimeHook).toBe(false);
    expect(json.data.meta.canProceedToProduction).toBe(false);
    expect(json.data.meta.productionFlagEnabled).toBe(false);
    expect(Object.keys(json.data)).not.toContain("providerId");
  });
});

describe("GET /api/provider/menu-profile/compatibility-cutover — success", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV] = "true";
    authedProvider({ admin: true });
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV];
    else process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV] = prevFlag;
  });

  test("returns compatibilityCutover evaluation with zero counters", async () => {
    mockReadLatest.mockResolvedValue(buildValidDraftDto());
    const { GET } = await import("@/app/api/provider/menu-profile/compatibility-cutover/route");
    const res = await GET({ nextUrl: new URL(compatibilityCutoverUrl("norwegian_company_lunch")) } as any);
    const json = await readJson(res);
    expect(res.status).toBe(200);
    expect(json.data.compatibilityCutover.compatibilityOnly).toBe(true);
    expect(json.data.compatibilityCutover.providerOnly).toBe(true);
    expect(json.data.compatibilityCutover.currentNoRuntimeUnchanged).toBe(true);
    expect(json.data.compatibilityCutover.employeeVisibleChanges).toBe(0);
    expect(json.data.compatibilityCutover.orderChanges).toBe(0);
    expect(json.data.compatibilityCutover.weekResponseChanges).toBe(0);
    expect(json.data.compatibilityCutover.publishChanges).toBe(0);
    expect(json.data.compatibilityCutover.sanityWrites).toBe(0);
    expect(json.data.compatibilityCutover.menuDayPayloadMutations).toBe(0);
    expect(json.data.compatibilityCutover.priceVisibleChanges).toBe(0);
    expect(json.data.compatibilityCutover.commercialVisibleChanges).toBe(0);
    expect(json.data.compatibilityCutover.canProceedToRuntimeHook).toBe(false);
    expect(json.data.compatibilityCutover.canProceedToProduction).toBe(false);
    expect(json.data.source.draftId).toBe("draft-compatibility-cutover-1");
    expect(json.data.source.menuProfileId).toBe("norwegian_company_lunch");
    expect(json.data.source.weekShadowSource.shadowOnly).toBe(true);
    expect(json.data.source.weekShadowSource.providerOnly).toBe(true);
  });

  test("response has no forbidden fields", async () => {
    mockReadLatest.mockResolvedValue(buildValidDraftDto());
    const { GET } = await import("@/app/api/provider/menu-profile/compatibility-cutover/route");
    const res = await GET({ nextUrl: new URL(compatibilityCutoverUrl("norwegian_company_lunch")) } as any);
    const json = await readJson(res);
    const forbidden = [
      "providerId",
      "employeePayload",
      "orderPayload",
      "menuDayPayloadMutation",
      "pricePreview",
      "provider_price_rules",
      "commission",
      "provisjon",
      "vat",
      "mva",
      "apply",
      "commit",
      "publishPayload",
      "sanityWritePayload",
      "activate",
      "enable",
      "productionEnable",
      "lp_order_set",
      "lp_order_advance_status",
    ];
    for (const field of forbidden) {
      expect(Object.keys(json.data.compatibilityCutover ?? {})).not.toContain(field);
      expect(Object.keys(json.data.source ?? {})).not.toContain(field);
      expect(Object.keys(json.data.meta ?? {})).not.toContain(field);
    }
    expect(json.data.meta.productionFlagEnabled).toBe(false);
  });
});

describe("GET /api/provider/menu-profile/compatibility-cutover — validation", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV] = "true";
    authedProvider({ admin: true });
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV];
    else process.env[LP_MENU_PROFILE_COMPATIBILITY_CUTOVER_ENV] = prevFlag;
  });

  test("invalid runtime-enabled draft returns 400 without leaking payload", async () => {
    const draft = buildValidDraftDto();
    draft.mappingJson = { ...(draft.mappingJson as object), isRuntimeEnabled: true };
    mockReadLatest.mockResolvedValue(draft);
    const { GET } = await import("@/app/api/provider/menu-profile/compatibility-cutover/route");
    const res = await GET({ nextUrl: new URL(compatibilityCutoverUrl("norwegian_company_lunch")) } as any);
    const json = await readJson(res);
    expect(res.status).toBe(400);
    expect(json.error).toBe("VALIDATION_FAILED");
    expect(JSON.stringify(json)).not.toContain("providerId");
    expect(JSON.stringify(json)).not.toContain("employeePayload");
  });
});

describe("G5d.6d helper integration (static)", () => {
  test("compatibility-cutover API route uses compatibility helper and shadow helpers", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const rel = "app/api/provider/menu-profile/compatibility-cutover/route.ts";
    const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    expect(src).toContain("isMenuProfileCompatibilityCutoverEnabled");
    expect(src).toContain("buildCompatibilityCutoverEvaluation");
    expect(src).toContain("buildRuntimeMappingWeekShadowEvaluation");
    expect(src).toContain("buildRuntimeMappingPublishShadowEvaluation");
    expect(src).toContain("readLatestRuntimeMappingDraft");
    expect(src).not.toMatch(/app\/api\/week\/route/);
    expect(src).not.toMatch(/app\/\(app\)\/week/);
    expect(src).not.toMatch(/from\s+["']@\/lib\/week/);
  });
});

describe("G5d.6d no-write proof (static)", () => {
  test("compatibility-cutover API route has no DB/Sanity/order/publish mutation imports or writes", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const rel = "app/api/provider/menu-profile/compatibility-cutover/route.ts";
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
      /pricePreview/,
      /provider_price_rules/,
    ];
    for (const pattern of forbidden) {
      expect(src, rel).not.toMatch(pattern);
    }
    expect(src).not.toMatch(/\.insert\(/);
    expect(src).not.toMatch(/\.delete\(/);
    expect(src).not.toMatch(/\.upsert\(/);
  });
});

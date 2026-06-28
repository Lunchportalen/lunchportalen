/**
 * G5d.5d — Week shadow API tests (read-only, flag-gated, provider_admin only).
 */
// @ts-nocheck

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV,
  isMenuProfileWeekShadowReadEnabled,
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
    id: "draft-week-shadow-1",
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

function weekShadowUrl(menuProfileId: string, extra = "") {
  return `http://localhost/api/provider/menu-profile/week-shadow?menuProfileId=${menuProfileId}${extra}`;
}

describe("LP_MENU_PROFILE_WEEK_SHADOW_READ flag", () => {
  test("defaults to false", () => {
    expect(isMenuProfileWeekShadowReadEnabled({})).toBe(false);
  });

  test("is true only for exact true", () => {
    expect(
      isMenuProfileWeekShadowReadEnabled({ [LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV]: "true" }),
    ).toBe(true);
    expect(isMenuProfileWeekShadowReadEnabled({ [LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV]: "1" })).toBe(
      false,
    );
  });
});

describe("GET /api/provider/menu-profile/week-shadow — flag", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV] = "true";
    mockReadLatest.mockResolvedValue(null);
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV];
    else process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV] = prevFlag;
  });

  test("returns 404 when flag is OFF without auth/DB/helper", async () => {
    process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV] = "false";
    authedProvider({ admin: true });
    const { GET } = await import("@/app/api/provider/menu-profile/week-shadow/route");
    const res = await GET({ nextUrl: new URL(weekShadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(404);
    expect(mockGetAuthContext).not.toHaveBeenCalled();
    expect(mockReadLatest).not.toHaveBeenCalled();
  });

  test("flag OFF rejects anon without auth path", async () => {
    process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV] = "false";
    mockGetAuthContext.mockResolvedValue({ ok: false });
    const { GET } = await import("@/app/api/provider/menu-profile/week-shadow/route");
    const res = await GET({ nextUrl: new URL(weekShadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(404);
    expect(mockGetAuthContext).not.toHaveBeenCalled();
  });
});

describe("GET /api/provider/menu-profile/week-shadow — auth", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV] = "true";
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV];
    else process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV] = prevFlag;
  });

  test("anon with flag ON → 401", async () => {
    mockGetAuthContext.mockResolvedValue({ ok: false });
    const { GET } = await import("@/app/api/provider/menu-profile/week-shadow/route");
    const res = await GET({ nextUrl: new URL(weekShadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(401);
  });

  test("no provider with flag ON → 403", async () => {
    mockGetAuthContext.mockResolvedValue({ ok: true, user: { id: "emp", email: "e@x.no" } });
    mockGetProviderAdminContext.mockResolvedValue({ primaryProvider: null });
    const { GET } = await import("@/app/api/provider/menu-profile/week-shadow/route");
    const res = await GET({ nextUrl: new URL(weekShadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(403);
  });

  test("provider_viewer with flag ON → 403", async () => {
    authedProvider({ userId: USER_VIEWER, admin: false, viewer: true });
    const { GET } = await import("@/app/api/provider/menu-profile/week-shadow/route");
    const res = await GET({ nextUrl: new URL(weekShadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(403);
    expect(mockReadLatest).not.toHaveBeenCalled();
  });

  test("provider_admin with flag ON → allowed", async () => {
    authedProvider({ admin: true });
    mockReadLatest.mockResolvedValue(buildValidDraftDto());
    const { GET } = await import("@/app/api/provider/menu-profile/week-shadow/route");
    const res = await GET({ nextUrl: new URL(weekShadowUrl("norwegian_company_lunch")) } as any);
    expect(res.status).toBe(200);
  });

  test("rejects client-supplied providerId query param → 400", async () => {
    authedProvider({ admin: true });
    const { GET } = await import("@/app/api/provider/menu-profile/week-shadow/route");
    const res = await GET({
      nextUrl: new URL(weekShadowUrl("norwegian_company_lunch", "&providerId=" + PROVIDER_B)),
    } as any);
    expect(res.status).toBe(400);
    expect(mockReadLatest).not.toHaveBeenCalled();
  });

  test("missing menuProfileId → 400", async () => {
    authedProvider({ admin: true });
    const { GET } = await import("@/app/api/provider/menu-profile/week-shadow/route");
    const res = await GET({
      nextUrl: new URL("http://localhost/api/provider/menu-profile/week-shadow"),
    } as any);
    expect(res.status).toBe(400);
  });

  test("GET uses server provider id only", async () => {
    authedProvider({ admin: true, providerId: PROVIDER_A });
    mockReadLatest.mockResolvedValue(buildValidDraftDto());
    const { GET } = await import("@/app/api/provider/menu-profile/week-shadow/route");
    await GET({ nextUrl: new URL(weekShadowUrl("norwegian_company_lunch")) } as any);
    expect(mockReadLatest.mock.calls[0]?.[0]?.providerId).toBe(PROVIDER_A);
  });
});

describe("GET /api/provider/menu-profile/week-shadow — no draft", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV] = "true";
    authedProvider({ admin: true });
    mockReadLatest.mockResolvedValue(null);
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV];
    else process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV] = prevFlag;
  });

  test("returns weekShadow null and safe meta", async () => {
    const { GET } = await import("@/app/api/provider/menu-profile/week-shadow/route");
    const res = await GET({ nextUrl: new URL(weekShadowUrl("norwegian_company_lunch")) } as any);
    const json = await readJson(res);
    expect(res.status).toBe(200);
    expect(json.data.weekShadow).toBeNull();
    expect(json.data.source).toBeNull();
    expect(json.data.meta.shadowOnly).toBe(true);
    expect(json.data.meta.providerOnly).toBe(true);
    expect(json.data.meta.currentWeekUnchanged).toBeNull();
    expect(json.data.meta.employeeVisibleChanges).toBe(0);
    expect(json.data.meta.orderChanges).toBe(0);
    expect(json.data.meta.weekResponseChanges).toBe(0);
    expect(json.data.meta.runtimeWrites).toBe(0);
    expect(json.data.meta.sanityWrites).toBe(0);
    expect(json.data.meta.productionFlagEnabled).toBe(false);
    expect(Object.keys(json.data)).not.toContain("providerId");
  });
});

describe("GET /api/provider/menu-profile/week-shadow — success", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV] = "true";
    authedProvider({ admin: true });
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV];
    else process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV] = prevFlag;
  });

  test("returns weekShadow evaluation with zero counters", async () => {
    mockReadLatest.mockResolvedValue(buildValidDraftDto());
    const { GET } = await import("@/app/api/provider/menu-profile/week-shadow/route");
    const res = await GET({ nextUrl: new URL(weekShadowUrl("norwegian_company_lunch")) } as any);
    const json = await readJson(res);
    expect(res.status).toBe(200);
    expect(json.data.weekShadow.shadowOnly).toBe(true);
    expect(json.data.weekShadow.providerOnly).toBe(true);
    expect(typeof json.data.weekShadow.currentWeekUnchanged).toBe("boolean");
    expect(json.data.weekShadow.employeeVisibleChanges).toBe(0);
    expect(json.data.weekShadow.orderChanges).toBe(0);
    expect(json.data.weekShadow.weekResponseChanges).toBe(0);
    expect(json.data.weekShadow.priceVisibleChanges).toBe(0);
    expect(json.data.weekShadow.commercialVisibleChanges).toBe(0);
    expect(json.data.meta.runtimeWrites).toBe(0);
    expect(json.data.meta.sanityWrites).toBe(0);
    expect(json.data.source.draftId).toBe("draft-week-shadow-1");
    expect(json.data.source.menuProfileId).toBe("norwegian_company_lunch");
    expect(json.data.source.publishShadowSource.shadowOnly).toBe(true);
  });

  test("response has no forbidden fields", async () => {
    mockReadLatest.mockResolvedValue(buildValidDraftDto());
    const { GET } = await import("@/app/api/provider/menu-profile/week-shadow/route");
    const res = await GET({ nextUrl: new URL(weekShadowUrl("norwegian_company_lunch")) } as any);
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
      "activate",
      "enable",
      "lp_order_set",
      "lp_order_advance_status",
    ];
    for (const field of forbidden) {
      expect(Object.keys(json.data.weekShadow ?? {})).not.toContain(field);
      expect(Object.keys(json.data.source ?? {})).not.toContain(field);
      expect(Object.keys(json.data.meta ?? {})).not.toContain(field);
    }
    expect(json.data.meta.productionFlagEnabled).toBe(false);
  });
});

describe("GET /api/provider/menu-profile/week-shadow — validation", () => {
  const prevFlag = process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV] = "true";
    authedProvider({ admin: true });
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV];
    else process.env[LP_MENU_PROFILE_WEEK_SHADOW_READ_ENV] = prevFlag;
  });

  test("invalid runtime-enabled draft returns 400 without leaking payload", async () => {
    const draft = buildValidDraftDto();
    draft.mappingJson = { ...(draft.mappingJson as object), isRuntimeEnabled: true };
    mockReadLatest.mockResolvedValue(draft);
    const { GET } = await import("@/app/api/provider/menu-profile/week-shadow/route");
    const res = await GET({ nextUrl: new URL(weekShadowUrl("norwegian_company_lunch")) } as any);
    const json = await readJson(res);
    expect(res.status).toBe(400);
    expect(json.error).toBe("VALIDATION_FAILED");
    expect(JSON.stringify(json)).not.toContain("providerId");
    expect(JSON.stringify(json)).not.toContain("employeePayload");
  });
});

describe("G5d.5d helper integration (static)", () => {
  test("week-shadow API route uses week shadow helper and publish shadow helper", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const rel = "app/api/provider/menu-profile/week-shadow/route.ts";
    const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    expect(src).toContain("isMenuProfileWeekShadowReadEnabled");
    expect(src).toContain("buildRuntimeMappingWeekShadowEvaluation");
    expect(src).toContain("buildRuntimeMappingPublishShadowEvaluation");
    expect(src).toContain("readLatestRuntimeMappingDraft");
    expect(src).not.toMatch(/app\/api\/week\/route/);
    expect(src).not.toMatch(/app\/\(app\)\/week/);
    expect(src).not.toMatch(/from\s+["']@\/lib\/week/);
  });
});

describe("G5d.5d no-write proof (static)", () => {
  test("week-shadow API route has no DB/Sanity/order/publish mutation imports or writes", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const rel = "app/api/provider/menu-profile/week-shadow/route.ts";
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
    expect(src).not.toMatch(/\.update\(/);
    expect(src).not.toMatch(/\.delete\(/);
    expect(src).not.toMatch(/\.upsert\(/);
  });
});

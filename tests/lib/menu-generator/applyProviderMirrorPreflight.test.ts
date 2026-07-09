import { beforeEach, describe, expect, it, vi } from "vitest";

const writeVarmrett = vi.fn();
const applyCatalog = vi.fn();

vi.mock("@/lib/menu-generator/featureFlag", () => ({
  isLocalizedFixedMenuGeneratorPanelEnabled: () => true,
}));

vi.mock("@/lib/provider-menu/providerMenuOrderLock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/provider-menu/providerMenuOrderLock")>();
  return {
    ...actual,
    loadProviderOrderLockState: async () => ({
      datesWithOrders: new Set(),
      lockedCatalogItemKeys: new Set(),
      orderCountsByDate: new Map(),
      queryFailed: false,
    }),
  };
});

vi.mock("@/lib/provider-menu/loadProviderMenuDays", () => ({
  loadProviderMenuDaysForDates: async () => [],
}));

vi.mock("@/lib/cms/lunchCategory", () => ({
  fetchLunchCategoryRowsForProvider: async () => [],
}));

vi.mock("@/lib/provider-menu/varmrettSharedWrite", () => ({
  writeGeneratedSharedVarmrettForProvider: (...args: unknown[]) => writeVarmrett(...args),
}));

vi.mock("@/lib/menu-generator/fullApplyWrite", () => ({
  applyCatalogCategories: (...args: unknown[]) => applyCatalog(...args),
}));

import { applyLocalizedGeneratedWeekMenu } from "@/lib/menu-generator/applyLocalizedGeneratedWeekMenu";
import type { ApplyLocalizedGeneratedWeekMenuInput } from "@/lib/menu-generator/applyTypes";
import type { ProviderSettingsMenuProfileRow } from "@/lib/providers/loadProviderSettingsMenuProfile";

const MELHUS = "11111111-1111-1111-1111-111111111111";
const SV_SE = "a08e4742-c89d-48c5-a6a8-cf8532179083";
const WEEK = "2031-09-01";

const settingsNb: ProviderSettingsMenuProfileRow = {
  providerId: MELHUS,
  locale: "nb-NO",
  menuProfileId: "norwegian_company_lunch",
  defaultCountryCode: "NO",
  defaultCurrency: "NOK",
};

const settingsSv: ProviderSettingsMenuProfileRow = {
  providerId: SV_SE,
  locale: "sv-SE",
  menuProfileId: "swedish_lunch",
  defaultCountryCode: "SE",
  defaultCurrency: "SEK",
};

const melhusMirror = {
  sanityId: MELHUS,
  name: "Melhus Catering AS",
  slug: "melhus-catering",
};

const svMirror = {
  sanityId: SV_SE,
  name: "Swedish Lunch Pilot",
  slug: "swedish-lunch-pilot",
};

const fakeSanityClient = {
  createOrReplace: vi.fn(),
  fetch: vi.fn(),
};

function baseInput(providerId: string, dryRun: boolean): ApplyLocalizedGeneratedWeekMenuInput {
  const settings = providerId === MELHUS ? settingsNb : settingsSv;
  return {
    providerId,
    weekStart: WEEK,
    menuLocale: settings.locale as ApplyLocalizedGeneratedWeekMenuInput["menuLocale"],
    country: settings.defaultCountryCode,
    menuProfileId: settings.menuProfileId as ApplyLocalizedGeneratedWeekMenuInput["menuProfileId"],
    packageTier: "LUXUS",
    overwriteMode: "create_missing_only_strict",
    categoryScope: "all_supported",
    dryRun,
    idempotencyKey: `test-${providerId}-${dryRun}`,
    providerSlug: providerId === MELHUS ? "melhus-catering" : "swedish-lunch-pilot",
  };
}

describe("applyLocalizedGeneratedWeekMenu provider mirror preflight", () => {
  beforeEach(() => {
    writeVarmrett.mockReset();
    applyCatalog.mockReset();
    writeVarmrett.mockResolvedValue({ ok: true, date: WEEK, status: "draft", reconciledDates: [] });
    applyCatalog.mockResolvedValue({ applied: [], errors: [] });
  });

  it("dryRun missing mirror reports applyBlocked without mutation hooks", async () => {
    const result = await applyLocalizedGeneratedWeekMenu(
      {
        env: { LP_LOCALIZED_FIXED_MENU_GENERATOR: "ON", LP_MENU_PROFILE_RESOLVER: "ON" },
        settingsRow: settingsSv,
        resolverResult: null,
        sanityClient: null,
        fetchProviderMirror: async () => null,
      },
      baseInput(SV_SE, true),
    );

    expect(result.mode).toBe("dry_run");
    expect(result.applyBlocked).toBe(true);
    expect(result.safeToApply).toBe(false);
    expect(result.providerMirrorPreflight?.blockerCode).toBe("PROVIDER_MIRROR_MISSING");
    expect(result.summary.totalGeneratedDays).toBeGreaterThan(0);
    expect(writeVarmrett).not.toHaveBeenCalled();
    expect(applyCatalog).not.toHaveBeenCalled();
  });

  it("apply missing mirror stops before writes with structured error", async () => {
    const result = await applyLocalizedGeneratedWeekMenu(
      {
        env: { LP_LOCALIZED_FIXED_MENU_GENERATOR: "ON", LP_MENU_PROFILE_RESOLVER: "ON" },
        settingsRow: settingsSv,
        resolverResult: null,
        sanityClient: fakeSanityClient as never,
        fetchProviderMirror: async () => null,
      },
      baseInput(SV_SE, false),
    );

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("provider_mirror_missing");
    expect(result.providerMirrorPreflight?.blockerCode).toBe("PROVIDER_MIRROR_MISSING");
    expect(result.audit.appliedDates).toHaveLength(0);
    expect(result.audit.appliedCatalogCategories).toHaveLength(0);
    expect(writeVarmrett).not.toHaveBeenCalled();
    expect(applyCatalog).not.toHaveBeenCalled();
    expect(fakeSanityClient.createOrReplace).not.toHaveBeenCalled();
  });

  it("apply slug mismatch stops before writes", async () => {
    const result = await applyLocalizedGeneratedWeekMenu(
      {
        env: { LP_LOCALIZED_FIXED_MENU_GENERATOR: "ON", LP_MENU_PROFILE_RESOLVER: "ON" },
        settingsRow: settingsSv,
        resolverResult: null,
        sanityClient: fakeSanityClient as never,
        fetchProviderMirror: async () => ({
          ...svMirror,
          slug: "wrong-slug",
        }),
      },
      baseInput(SV_SE, false),
    );

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("provider_mirror_slug_mismatch");
    expect(writeVarmrett).not.toHaveBeenCalled();
    expect(applyCatalog).not.toHaveBeenCalled();
  });

  it("apply with valid mirror proceeds to writes (strict path unchanged)", async () => {
    const result = await applyLocalizedGeneratedWeekMenu(
      {
        env: { LP_LOCALIZED_FIXED_MENU_GENERATOR: "ON", LP_MENU_PROFILE_RESOLVER: "ON" },
        settingsRow: settingsNb,
        resolverResult: null,
        sanityClient: fakeSanityClient as never,
        fetchProviderMirror: async () => melhusMirror,
        providerSlug: "melhus-catering",
      },
      baseInput(MELHUS, false),
    );

    expect(result.ok).toBe(true);
    expect(result.safeToApply).toBe(true);
    expect(result.applyBlocked).toBe(false);
    expect(result.providerMirrorPreflight?.ok).toBe(true);
    expect(writeVarmrett).toHaveBeenCalled();
  });

  it("dryRun with valid mirror stays safeToApply true", async () => {
    const result = await applyLocalizedGeneratedWeekMenu(
      {
        env: { LP_LOCALIZED_FIXED_MENU_GENERATOR: "ON", LP_MENU_PROFILE_RESOLVER: "ON" },
        settingsRow: settingsNb,
        resolverResult: null,
        sanityClient: null,
        fetchProviderMirror: async () => melhusMirror,
      },
      baseInput(MELHUS, true),
    );

    expect(result.applyBlocked).toBe(false);
    expect(result.safeToApply).toBe(true);
    expect(result.providerMirrorPreflight?.ok).toBe(true);
    expect(result.summary.createdDraftDays).toBe(5);
  });
});

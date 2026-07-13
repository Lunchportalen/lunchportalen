import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertMenuProfile,
  getDefaultMenuProfileForMarket,
  getMarketDefaults,
  getMenuProfile,
  isSupportedMenuProfile,
  listMenuProfiles,
  MARKET_DEFAULTS,
  MENU_PROFILE_IDS,
} from "@/lib/menu-profile";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const MENU_PROFILE_DIR = path.join(ROOT, "lib/menu-profile");
const SERVER_ONLY_MENU_PROFILE_FILES = new Set(["runtimeMappingDraftPersistence.server.ts"]);

describe("menuProfileRegistry (ADR-019 G0 — inert)", () => {
  it("listMenuProfiles returns every registered profile", () => {
    const profiles = listMenuProfiles();
    expect(profiles).toHaveLength(MENU_PROFILE_IDS.length);
    expect(profiles.map((p) => p.id).sort()).toEqual([...MENU_PROFILE_IDS].sort());
  });

  it.each(MENU_PROFILE_IDS)("profile %s has market, locale and market default currency", (profileId) => {
    const profile = getMenuProfile(profileId);
    const defaults = getMarketDefaults(profile.market);

    expect(profile.market).toBe(defaults.market);
    if (defaults.defaultMenuProfileId === profileId) {
      expect(profile.locale).toBe(defaults.defaultLocale);
    }
    expect(defaults.defaultCurrency).toBeTruthy();
  });

  it.each(MENU_PROFILE_IDS)("profile %s has basis, luxus and enterprise packages", (profileId) => {
    const { packageModel } = getMenuProfile(profileId);

    expect(packageModel.basis.key).toBe("basis");
    expect(packageModel.luxus.key).toBe("luxus");
    expect(packageModel.enterprise.key).toBe("enterprise");
    expect(packageModel.basis.categoryKeys.length).toBeGreaterThan(0);
    expect(packageModel.luxus.categoryKeys.length).toBeGreaterThan(packageModel.basis.categoryKeys.length);
    expect(packageModel.enterprise.categoryKeys.length).toBeGreaterThanOrEqual(
      packageModel.luxus.categoryKeys.length,
    );
  });

  it.each(MENU_PROFILE_IDS)(
    "profile %s has warm dish category and warm dish bank entries",
    (profileId) => {
      const profile = getMenuProfile(profileId);
      const hasWarmDishCategory = profile.fixedChoiceCategories.some((c) => c.kind === "warm_dish");
      const basisIncludesWarmDish = profile.packageModel.basis.includesSharedWarmDish;

      expect(hasWarmDishCategory || basisIncludesWarmDish).toBe(true);
      expect(profile.warmDishBank.length).toBeGreaterThan(0);
      expect(profile.warmDishRules.requireOneSharedWarmDishPerDeliveryDay).toBe(true);
    },
  );

  it.each(MENU_PROFILE_IDS)(
    "profile %s treats enterprise upgrade as metadata, not separate warm dish",
    (profileId) => {
      const profile = getMenuProfile(profileId);
      const upgradeCategory = profile.fixedChoiceCategories.find((c) => c.key === "enterprise_upgrade");

      expect(upgradeCategory?.kind).toBe("upgrade");
      expect(profile.packageModel.enterprise.enterpriseUpgrade).toBe(true);
      expect(profile.enterpriseUpgradeModel?.enabled).toBe(true);

      const warmDishKeys = profile.fixedChoiceCategories
        .filter((c) => c.kind === "warm_dish")
        .map((c) => c.key);
      expect(profile.packageModel.enterprise.categoryKeys).toContain("enterprise_upgrade");
      for (const key of warmDishKeys) {
        expect(profile.packageModel.enterprise.categoryKeys.filter((k) => k === key)).toHaveLength(1);
      }
    },
  );

  describe("NO profile seed mirrors current Norwegian category logic", () => {
    const no = getMenuProfile("norwegian_company_lunch");

    it("Basis includes paasmurt, salatboks, varmrett", () => {
      expect(no.packageModel.basis.categoryKeys).toEqual(["paasmurt", "salatboks", "varmrett"]);
    });

    it("Luxus includes sushi, pokebowl, thaimat in addition to Basis categories", () => {
      expect(no.packageModel.luxus.categoryKeys).toEqual([
        "paasmurt",
        "salatboks",
        "varmrett",
        "sushi",
        "pokebowl",
        "thaimat",
      ]);
    });

    it("Enterprise includes enterprise_upgrade without separate warm dish slot", () => {
      expect(no.packageModel.enterprise.categoryKeys).toContain("enterprise_upgrade");
      expect(no.packageModel.enterprise.categoryKeys).toEqual([
        "paasmurt",
        "salatboks",
        "varmrett",
        "sushi",
        "pokebowl",
        "thaimat",
        "enterprise_upgrade",
      ]);
      expect(no.packageModel.luxus.categoryKeys).toEqual(
        no.packageModel.enterprise.categoryKeys.filter((k) => k !== "enterprise_upgrade"),
      );
    });

    it("maps to current order-choice keys as seed (salatboks, thaimat, varmrett)", () => {
      const keys = no.fixedChoiceCategories.map((c) => c.key);
      expect(keys).toContain("salatboks");
      expect(keys).toContain("thaimat");
      expect(keys).toContain("varmrett");
    });
  });

  it('getDefaultMenuProfileForMarket("NO") returns norwegian_company_lunch', () => {
    expect(getDefaultMenuProfileForMarket("NO").id).toBe("norwegian_company_lunch");
    expect(getMarketDefaults("NO").defaultCurrency).toBe(`${"NO"}K`);
  });

  it('getDefaultMenuProfileForMarket("GB") returns uk_office_lunch', () => {
    expect(getDefaultMenuProfileForMarket("GB").id).toBe("uk_office_lunch");
  });

  it('getDefaultMenuProfileForMarket("IT") returns italian_office_lunch with EUR / it-IT', () => {
    expect(getDefaultMenuProfileForMarket("IT").id).toBe("italian_office_lunch");
    expect(getMarketDefaults("IT").defaultCurrency).toBe("EUR");
    expect(getMarketDefaults("IT").defaultLocale).toBe("it-IT");
  });

  describe("IT profile packages", () => {
    const itProfile = getMenuProfile("italian_office_lunch");

    it("Basis includes panini, insalata, primo_del_giorno", () => {
      expect(itProfile.packageModel.basis.categoryKeys).toEqual([
        "panini",
        "insalata",
        "primo_del_giorno",
      ]);
    });

    it("Luxus adds bowl and piatto_freddo", () => {
      expect(itProfile.packageModel.luxus.categoryKeys).toEqual([
        "panini",
        "insalata",
        "primo_del_giorno",
        "bowl",
        "piatto_freddo",
      ]);
    });

    it("Enterprise adds enterprise_upgrade without separate warm dish", () => {
      expect(itProfile.packageModel.enterprise.enterpriseUpgrade).toBe(true);
      expect(itProfile.packageModel.enterprise.categoryKeys).toContain("enterprise_upgrade");
    });
  });

  it("invalid profile id is fail-closed", () => {
    expect(isSupportedMenuProfile("invalid_profile")).toBe(false);
    expect(isSupportedMenuProfile("")).toBe(false);
    expect(() => assertMenuProfile("not_a_profile")).toThrow(/Unknown menu profile/);
    expect(() => assertMenuProfile("")).toThrow(/Unknown menu profile/);
  });

  it("MARKET_DEFAULTS covers every registered profile market", () => {
    const profileMarkets = new Set(listMenuProfiles().map((profile) => profile.market));
    for (const market of profileMarkets) {
      expect(MARKET_DEFAULTS[market]).toBeTruthy();
    }
  });

  describe("no runtime coupling", () => {
    const FORBIDDEN_IMPORT_PATTERNS = [
      /@\/app\//,
      /@\/components\//,
      /from ["']@\/app/,
      /from ["']@\/components/,
      /from ["'].*\/app\/api/,
      /from ["']@supabase/,
      /from ["'].*supabase/,
    ];

    it("lib/menu-profile source files have no forbidden imports", () => {
      const files = readdirSync(MENU_PROFILE_DIR).filter((f) => f.endsWith(".ts"));
      expect(files.length).toBeGreaterThan(0);

      for (const file of files) {
        if (SERVER_ONLY_MENU_PROFILE_FILES.has(file)) continue;
        const src = readFileSync(path.join(MENU_PROFILE_DIR, file), "utf8");
        const importBlock = src
          .split(/\r?\n/)
          .filter((line) => /^\s*import\s/.test(line))
          .join("\n");

        for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
          expect(importBlock, `${file} must not import ${pattern}`).not.toMatch(pattern);
        }

        expect(src, `${file} must not use process.env`).not.toMatch(/process\.env/);
        expect(src, `${file} must not fetch`).not.toMatch(/\bfetch\s*\(/);
      }
    });

    it("registry modules only import from lib/menu-profile", () => {
      for (const file of ["registry.ts", "marketDefaults.ts", "index.ts", "warmDishBankSeeds.ts"]) {
        const src = readFileSync(path.join(MENU_PROFILE_DIR, file), "utf8");
        const importBlocks = [...src.matchAll(/import[\s\S]*?from\s+["'][^"']+["']/g)];

        for (const match of importBlocks) {
          const block = match[0];
          expect(block, `${file} must import only from lib/menu-profile`).toMatch(/@\/lib\/menu-profile\//);
        }
      }
    });
  });
});

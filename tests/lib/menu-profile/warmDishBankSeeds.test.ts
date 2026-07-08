import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getMarketDefaults,
  getWarmDishBankSeedsForMarket,
  getWarmDishBankSeedsForProfile,
  listMenuProfiles,
  listWarmDishBankSeeds,
  MARKET_CODES,
  MENU_PROFILE_IDS,
  assertWarmDishBankSeed,
} from "@/lib/menu-profile";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const MENU_PROFILE_DIR = path.join(ROOT, "lib/menu-profile");
const SERVER_ONLY_MENU_PROFILE_FILES = new Set(["runtimeMappingDraftPersistence.server.ts"]);

const EXPECTED_MARKETS = MARKET_CODES;

describe("warmDishBankSeeds (ADR-019 G0.2 — inert)", () => {
  it("has warm dish bank entries for all profile markets", () => {
    const seeds = listWarmDishBankSeeds();
    expect(seeds.length).toBe(MENU_PROFILE_IDS.length * 5);

    for (const market of EXPECTED_MARKETS) {
      const marketSeeds = getWarmDishBankSeedsForMarket(market);
      expect(marketSeeds.length).toBeGreaterThanOrEqual(5);
      expect(marketSeeds.every((s) => s.market === market)).toBe(true);
    }
  });

  it.each(MENU_PROFILE_IDS)("profile %s has at least five warm dish seeds", (profileId) => {
    const seeds = getWarmDishBankSeedsForProfile(profileId);
    expect(seeds.length).toBe(5);
    expect(seeds.every((s) => s.profileId === profileId)).toBe(true);
  });

  it("every seed profileId exists in menu profile registry", () => {
    const registryIds = new Set(listMenuProfiles().map((p) => p.id));
    for (const seed of listWarmDishBankSeeds()) {
      expect(registryIds.has(seed.profileId)).toBe(true);
    }
  });

  it("every seed market exists in marketDefaults", () => {
    for (const market of MARKET_CODES) {
      expect(() => getMarketDefaults(market)).not.toThrow();
    }
  });

  it("IT warm dish bank exists with Italian locale titles", () => {
    const itSeeds = getWarmDishBankSeedsForProfile("italian_office_lunch");
    expect(itSeeds).toHaveLength(5);
    expect(itSeeds[0]?.locale).toBe("it-IT");
    expect(itSeeds.some((s) => s.title.includes("Lasagne"))).toBe(true);
    expect(itSeeds.some((s) => s.key === "risotto-ai-funghi")).toBe(true);
  });

  it("seed titles are literal data, not UI message keys", () => {
    for (const seed of listWarmDishBankSeeds()) {
      expect(seed.title).not.toMatch(/^menuProfile\./);
      expect(seed.title).not.toMatch(/^provider\./);
      expect(seed.title.length).toBeGreaterThan(2);
    }
  });

  it("invalid seed key is fail-closed", () => {
    expect(() => assertWarmDishBankSeed("not-a-seed")).toThrow(/Unknown warm dish bank seed/);
  });

  describe("no runtime coupling", () => {
    it("warmDishBankSeeds.ts has no forbidden imports or side effects", () => {
      const src = readFileSync(path.join(MENU_PROFILE_DIR, "warmDishBankSeeds.ts"), "utf8");
      const importBlock = src
        .split(/\r?\n/)
        .filter((line) => /^\s*import\s/.test(line))
        .join("\n");

      expect(importBlock).toMatch(/@\/lib\/menu-profile\/types/);
      expect(importBlock).not.toMatch(/@\/app/);
      expect(importBlock).not.toMatch(/@\/components/);
      expect(importBlock).not.toMatch(/supabase/);
      expect(src).not.toMatch(/process\.env/);
      expect(src).not.toMatch(/\bfetch\s*\(/);
    });

    it("all lib/menu-profile files remain inert", () => {
      const files = readdirSync(MENU_PROFILE_DIR).filter((f) => f.endsWith(".ts"));
      for (const file of files) {
        if (SERVER_ONLY_MENU_PROFILE_FILES.has(file)) continue;
        const src = readFileSync(path.join(MENU_PROFILE_DIR, file), "utf8");
        expect(src, file).not.toMatch(/process\.env/);
        expect(src, file).not.toMatch(/\bfetch\s*\(/);
      }
    });
  });
});

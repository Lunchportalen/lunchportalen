import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isMenuProfileResolverEnabled,
  LP_MENU_PROFILE_RESOLVER_ENV,
  resolveMenuProfileForProvider,
} from "@/lib/menu-profile";
import type { MenuProfileResolverError } from "@/lib/menu-profile";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const MENU_PROFILE_DIR = path.join(ROOT, "lib/menu-profile");
const ENV_KEY = LP_MENU_PROFILE_RESOLVER_ENV;

describe("menuProfileResolver (ADR-019 G1 — inert, flag default OFF)", () => {
  const originalEnv = process.env[ENV_KEY];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalEnv;
    }
  });

  describe("isMenuProfileResolverEnabled", () => {
    it("undefined env = disabled", () => {
      expect(isMenuProfileResolverEnabled({})).toBe(false);
      expect(isMenuProfileResolverEnabled({ [ENV_KEY]: undefined })).toBe(false);
    });

    it.each(["false", "0", "", "yes", "TRUE", "2", "on"])("invalid/disabled value %s = disabled", (value) => {
      expect(isMenuProfileResolverEnabled({ [ENV_KEY]: value })).toBe(false);
    });

    it.each(["true", "1"])("enabled value %s = enabled", (value) => {
      expect(isMenuProfileResolverEnabled({ [ENV_KEY]: value })).toBe(true);
    });
  });

  describe("resolveMenuProfileForProvider when flag OFF", () => {
    beforeEach(() => {
      delete process.env[ENV_KEY];
    });

    it("returns legacy_disabled with norwegian_company_lunch", () => {
      const result = resolveMenuProfileForProvider({
        menuProfileId: "italian_office_lunch",
        market: "IT",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.enabled).toBe(false);
      expect(result.source).toBe("legacy_disabled");
      expect(result.profile.id).toBe("norwegian_company_lunch");
    });

    it("stays disabled when env omitted even if process.env is set", () => {
      process.env[ENV_KEY] = "true";
      const result = resolveMenuProfileForProvider({ menuProfileId: "italian_office_lunch" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.enabled).toBe(false);
      expect(result.source).toBe("legacy_disabled");
    });
  });

  describe("resolveMenuProfileForProvider when flag ON", () => {
    const enabledEnv = () => ({ [ENV_KEY]: "true" });

    it("valid menuProfileId returns provider_setting", () => {
      const result = resolveMenuProfileForProvider({
        menuProfileId: "swedish_lunch",
        market: "SE",
        env: enabledEnv(),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.enabled).toBe(true);
      expect(result.source).toBe("provider_setting");
      expect(result.profile.id).toBe("swedish_lunch");
    });

    it("IT profile returns italian_office_lunch", () => {
      const result = resolveMenuProfileForProvider({
        menuProfileId: "italian_office_lunch",
        env: enabledEnv(),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.source).toBe("provider_setting");
      expect(result.profile.id).toBe("italian_office_lunch");
    });

    it("market IT returns italian_office_lunch via market_default", () => {
      const result = resolveMenuProfileForProvider({ market: "IT", env: enabledEnv() });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.source).toBe("market_default");
      expect(result.profile.id).toBe("italian_office_lunch");
    });

    it("market UK returns uk_office_lunch via market_default", () => {
      const result = resolveMenuProfileForProvider({ market: "UK", env: enabledEnv() });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.source).toBe("market_default");
      expect(result.profile.id).toBe("uk_office_lunch");
    });

    it("invalid profile fails closed with unsupported_menu_profile", () => {
      const result = resolveMenuProfileForProvider({
        menuProfileId: "not_a_real_profile",
        env: enabledEnv(),
      });
      expect(result.ok).toBe(false);
      const err = result as MenuProfileResolverError;
      expect(err.enabled).toBe(true);
      expect(err.reason).toBe("unsupported_menu_profile");
      expect(err.message).toMatch(/Unknown menu profile/);
    });

    it("missing profile and market returns fallback_no_market with warning", () => {
      const result = resolveMenuProfileForProvider({ env: enabledEnv() });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.source).toBe("fallback_no_market");
      expect(result.profile.id).toBe("norwegian_company_lunch");
      expect(result.warning).toMatch(/NO default/i);
    });
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

    it("resolver and featureFlag import only from lib/menu-profile", () => {
      for (const file of ["resolver.ts", "featureFlag.ts"]) {
        const src = readFileSync(path.join(MENU_PROFILE_DIR, file), "utf8");
        const importBlocks = [...src.matchAll(/import[\s\S]*?from\s+["'][^"']+["']/g)];

        for (const match of importBlocks) {
          expect(match[0], file).toMatch(/@\/lib\/menu-profile\//);
        }
      }
    });

    it("lib/menu-profile files have no forbidden imports", () => {
      const files = readdirSync(MENU_PROFILE_DIR).filter((f) => f.endsWith(".ts"));
      for (const file of files) {
        const src = readFileSync(path.join(MENU_PROFILE_DIR, file), "utf8");
        const importBlock = src
          .split(/\r?\n/)
          .filter((line) => /^\s*import\s/.test(line))
          .join("\n");

        for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
          expect(importBlock, `${file} must not import ${pattern}`).not.toMatch(pattern);
        }
      }
    });

    it("no runtime files import menu profile resolver", () => {
      const runtimeRoots = ["app", "components", "lib/providers", "lib/menu-publish"];
      const resolverImport = /@\/lib\/menu-profile\/resolver|resolveMenuProfileForProvider/;

      for (const root of runtimeRoots) {
        const abs = path.join(ROOT, root);
        try {
          walkTsFiles(abs, (filePath) => {
            if (filePath.includes(`${path.sep}lib${path.sep}menu-profile${path.sep}`)) return;
            if (filePath.includes(`${path.sep}tests${path.sep}`)) return;
            const src = readFileSync(filePath, "utf8");
            expect(src, filePath).not.toMatch(resolverImport);
          });
        } catch {
          // optional root may not exist
        }
      }
    });
  });
});

function walkTsFiles(dir: string, visit: (filePath: string) => void) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkTsFiles(full, visit);
      continue;
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      visit(full);
    }
  }
}

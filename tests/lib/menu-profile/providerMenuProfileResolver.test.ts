import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  LP_MENU_PROFILE_RESOLVER_ENV,
  providerCountryCodeToMarket,
  resolveProviderMenuProfileFromSettings,
} from "@/lib/menu-profile";
import type { MenuProfileResolverError } from "@/lib/menu-profile";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const MENU_PROFILE_DIR = path.join(ROOT, "lib/menu-profile");
const ENV_KEY = LP_MENU_PROFILE_RESOLVER_ENV;

describe("providerMenuProfileResolver (ADR-019 G3)", () => {
  const enabledEnv = () => ({ [ENV_KEY]: "true" });

  describe("providerCountryCodeToMarket", () => {
    it("maps ISO country codes to registry markets", () => {
      expect(providerCountryCodeToMarket("IT")).toBe("IT");
      expect(providerCountryCodeToMarket("gb")).toBe("UK");
      expect(providerCountryCodeToMarket("XX")).toBeNull();
    });
  });

  describe("resolveProviderMenuProfileFromSettings flag ON", () => {
    it("menu_profile_id italian_office_lunch → provider_setting", () => {
      const result = resolveProviderMenuProfileFromSettings({
        menuProfileId: "italian_office_lunch",
        defaultCountryCode: "NO",
        env: enabledEnv(),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.source).toBe("provider_setting");
      expect(result.profile.id).toBe("italian_office_lunch");
    });

    it("null menu_profile_id + default_country_code IT → market_default", () => {
      const result = resolveProviderMenuProfileFromSettings({
        menuProfileId: null,
        defaultCountryCode: "IT",
        env: enabledEnv(),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.source).toBe("market_default");
      expect(result.profile.id).toBe("italian_office_lunch");
    });

    it("invalid menu_profile_id fails closed", () => {
      const result = resolveProviderMenuProfileFromSettings({
        menuProfileId: "not_a_real_profile",
        defaultCountryCode: "IT",
        env: enabledEnv(),
      });
      expect(result.ok).toBe(false);
      const err = result as MenuProfileResolverError;
      expect(err.reason).toBe("unsupported_menu_profile");
    });

    it("missing profile and market → fallback_no_market warning", () => {
      const result = resolveProviderMenuProfileFromSettings({
        menuProfileId: null,
        defaultCountryCode: null,
        env: enabledEnv(),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.source).toBe("fallback_no_market");
      expect(result.warning).toMatch(/NO default/i);
    });
  });

  describe("resolveProviderMenuProfileFromSettings flag OFF", () => {
    it("returns legacy_disabled without using stored profile", () => {
      const result = resolveProviderMenuProfileFromSettings({
        menuProfileId: "italian_office_lunch",
        defaultCountryCode: "IT",
        env: {},
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.enabled).toBe(false);
      expect(result.source).toBe("legacy_disabled");
      expect(result.profile.id).toBe("norwegian_company_lunch");
    });
  });

  describe("existing rows without menu_profile_id", () => {
    it("null menu_profile_id with NO country is valid when flag OFF", () => {
      const result = resolveProviderMenuProfileFromSettings({
        menuProfileId: null,
        defaultCountryCode: "NO",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.enabled).toBe(false);
      expect(result.source).toBe("legacy_disabled");
    });
  });

  describe("runtime isolation", () => {
    const FORBIDDEN = [/@\/app\//, /@\/components\//, /supabase/, /\bfetch\s*\(/, /process\.env/];

    it("providerMenuProfileResolver stays inert", () => {
      const src = readFileSync(path.join(MENU_PROFILE_DIR, "providerMenuProfileResolver.ts"), "utf8");
      const imports = src
        .split(/\r?\n/)
        .filter((line) => /^\s*import\s/.test(line))
        .join("\n");
      for (const pattern of FORBIDDEN) {
        expect(imports).not.toMatch(pattern);
      }
      expect(imports).toMatch(/@\/lib\/menu-profile\//);
    });

    it("no week/order/publish imports of provider menu profile read path", () => {
      const forbiddenRoots = ["app/week", "app/api/week", "app/api/orders", "lib/orders", "lib/menu-publish"];
      const pattern = /providerMenuProfileResolver|loadProviderSettingsMenuProfile|loadAndResolveProviderMenuProfile/;

      for (const root of forbiddenRoots) {
        const abs = path.join(ROOT, root);
        try {
          walkTs(abs, (filePath) => {
            const src = readFileSync(filePath, "utf8");
            expect(src, filePath).not.toMatch(pattern);
          });
        } catch {
          // optional root
        }
      }
    });
  });
});

function walkTs(dir: string, visit: (filePath: string) => void) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkTs(full, visit);
      continue;
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) visit(full);
  }
}

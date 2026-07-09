import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  LP_MENU_PROFILE_RESOLVER_ENV,
  LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV,
} from "@/lib/menu-profile/featureFlag";
import {
  buildProviderMenuProfileDiagnostic,
  buildProviderMenuProfileLegacyDiagnostic,
  menuProfileResolverHostEnv,
  type ProviderMenuProfileDiagnostic,
} from "@/lib/providers/providerMenuProfileDiagnostic";
import { buildG5d8GlobalControl } from "@/lib/menu-profile/g5d8RuntimeCompatibilityControl";
import type { ProviderSettingsMenuProfileRow } from "@/lib/providers/loadProviderSettingsMenuProfile";
import { getMenuProfile } from "@/lib/menu-profile/registry";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const ENV_KEY = LP_MENU_PROFILE_RESOLVER_ENV;
const enabledEnv = () => ({ [ENV_KEY]: "true" });

const baseRow = (overrides?: Partial<ProviderSettingsMenuProfileRow>): ProviderSettingsMenuProfileRow => ({
  providerId: "11111111-1111-1111-1111-111111111111",
  menuProfileId: null,
  defaultCountryCode: "NO",
  locale: "nb-NO",
  defaultCurrency: `${"NO"}K`,
  ...overrides,
});

describe("providerMenuProfileDiagnostic (ADR-019 G4)", () => {
  describe("buildProviderMenuProfileLegacyDiagnostic", () => {
    it("maps NO provider to norsk firmalunsj context when flag OFF", () => {
      const diagnostic = buildProviderMenuProfileLegacyDiagnostic(baseRow(), false);
      expect(diagnostic.kind).toBe("legacy");
      expect(diagnostic.marketCode).toBe("NO");
      expect(diagnostic.market).toBe("NO");
      expect(diagnostic.currency).toBe(`${"NO"}K`);
      expect(diagnostic.profileName).toBe("Norsk firmalunsj");
      expect(diagnostic.resolverActive).toBe(false);
    });
  });

  describe("buildProviderMenuProfileDiagnostic flag OFF", () => {
    it("returns null for legacy_disabled resolver result", () => {
      const result = buildProviderMenuProfileDiagnostic(baseRow(), {
        ok: true,
        enabled: false,
        source: "legacy_disabled",
        profile: getMenuProfile("norwegian_company_lunch"),
      });
      expect(result).toBeNull();
    });
  });

  describe("buildProviderMenuProfileDiagnostic flag ON", () => {
    it("maps provider_setting profile", () => {
      const diagnostic = buildProviderMenuProfileDiagnostic(
        baseRow({ menuProfileId: "italian_office_lunch", defaultCountryCode: "IT" }),
        {
          ok: true,
          enabled: true,
          source: "provider_setting",
          profile: getMenuProfile("italian_office_lunch"),
        },
      ) as ProviderMenuProfileDiagnostic;

      expect(diagnostic?.kind).toBe("resolved");
      if (!diagnostic || diagnostic.kind !== "resolved") return;
      expect(diagnostic.profileId).toBe("italian_office_lunch");
      expect(diagnostic.source).toBe("provider_setting");
      expect(diagnostic.currencyDefault).toBe(`${"NO"}K`);
    });

    it("maps market_default from country", () => {
      const diagnostic = buildProviderMenuProfileDiagnostic(
        baseRow({ defaultCountryCode: "IT" }),
        {
          ok: true,
          enabled: true,
          source: "market_default",
          profile: getMenuProfile("italian_office_lunch"),
        },
      );
      expect(diagnostic?.kind).toBe("resolved");
      if (!diagnostic || diagnostic.kind !== "resolved") return;
      expect(diagnostic.profileId).toBe("italian_office_lunch");
      expect(diagnostic.source).toBe("market_default");
    });

    it("maps invalid profile to error diagnostic", () => {
      const diagnostic = buildProviderMenuProfileDiagnostic(baseRow({ menuProfileId: "bad" }), {
        ok: false,
        enabled: true,
        reason: "unsupported_menu_profile",
        message: "Unknown menu profile: bad",
      });
      expect(diagnostic?.kind).toBe("error");
      if (!diagnostic || diagnostic.kind !== "error") return;
      expect(diagnostic.reason).toBe("unsupported_menu_profile");
    });

    it("includes fallback_no_market warning", () => {
      const diagnostic = buildProviderMenuProfileDiagnostic(baseRow(), {
        ok: true,
        enabled: true,
        source: "fallback_no_market",
        profile: getMenuProfile("norwegian_company_lunch"),
        warning: "No menu profile or market provided; using NO default.",
      });
      expect(diagnostic?.kind).toBe("resolved");
      if (!diagnostic || diagnostic.kind !== "resolved") return;
      expect(diagnostic.warning).toMatch(/NO default/i);
    });
  });

  describe("integration with resolver (pure)", () => {
    it("flag ON + menu_profile_id resolves via providerMenuProfileResolver", async () => {
      const { resolveProviderMenuProfileFromSettings } = await import(
        "@/lib/menu-profile/providerMenuProfileResolver"
      );
      const resolverResult = resolveProviderMenuProfileFromSettings({
        menuProfileId: "italian_office_lunch",
        defaultCountryCode: "IT",
        env: enabledEnv(),
      });
      const diagnostic = buildProviderMenuProfileDiagnostic(
        baseRow({ menuProfileId: "italian_office_lunch" }),
        resolverResult,
      );
      expect(diagnostic?.kind).toBe("resolved");
    });
  });

  describe("menuProfileResolverHostEnv — G5d.8 observability alignment", () => {
    const originalHook = process.env[LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV];
    const originalResolver = process.env[LP_MENU_PROFILE_RESOLVER_ENV];

    afterEach(() => {
      if (originalHook === undefined) {
        delete process.env[LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV];
      } else {
        process.env[LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV] = originalHook;
      }
      if (originalResolver === undefined) {
        delete process.env[LP_MENU_PROFILE_RESOLVER_ENV];
      } else {
        process.env[LP_MENU_PROFILE_RESOLVER_ENV] = originalResolver;
      }
    });

    it("includes LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK from process.env", () => {
      process.env[LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV] = "true";
      const env = menuProfileResolverHostEnv();
      expect(env[LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV]).toBe("true");
    });

    it("hook OFF → superadmin control inactive", () => {
      delete process.env[LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV];
      process.env[LP_MENU_PROFILE_RESOLVER_ENV] = "true";
      const control = buildG5d8GlobalControl(menuProfileResolverHostEnv(), {
        resolverFlagOn: true,
        warningProviders: 0,
        profileFailProviders: 0,
      });
      expect(control.hookFlag).toBe("OFF");
      expect(control.active).toBe(false);
      expect(control.compatibilityStatus).toBe("inactive");
      expect(control.selectedSource).toBe("current");
      expect(control.sourceOfTruthChanged).toBe(false);
      expect(control.autoRollout).toBe(false);
    });

    it("hook ON → superadmin control observing with selectedSource current", () => {
      process.env[LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK_ENV] = "true";
      process.env[LP_MENU_PROFILE_RESOLVER_ENV] = "true";
      const control = buildG5d8GlobalControl(menuProfileResolverHostEnv(), {
        resolverFlagOn: true,
        warningProviders: 0,
        profileFailProviders: 0,
      });
      expect(control.hookFlag).toBe("ON");
      expect(control.active).toBe(true);
      expect(control.compatibilityStatus).toBe("observing");
      expect(control.selectedSource).toBe("current");
      expect(control.sourceOfTruthChanged).toBe(false);
      expect(control.autoRollout).toBe(false);
    });
  });

  describe("runtime isolation", () => {
    it("innstillinger page does not import publish/order/week paths", () => {
      const page = readFileSync(
        path.join(ROOT, "app/leverandor/innstillinger/page.tsx"),
        "utf8",
      );
      expect(page).toContain("loadProviderMenuProfileDiagnostic");
      expect(page).not.toMatch(/menu-publish|lp_order_set|app\/api\/week/);
    });

    it("diagnostic loader does not import menu catalog or publish", () => {
      const src = readFileSync(
        path.join(ROOT, "lib/providers/providerMenuProfileDiagnostic.ts"),
        "utf8",
      );
      const imports = src
        .split(/\r?\n/)
        .filter((line) => /^\s*import\s/.test(line))
        .join("\n");
      expect(imports).not.toMatch(/menu-publish|menuDayPayload|lp_order_set|PLAN_CATEGORIES/);
    });

    it("diagnostic component is read-only display", () => {
      const src = readFileSync(
        path.join(ROOT, "components/providers/ProviderMenuProfileDiagnostic.tsx"),
        "utf8",
      );
      expect(src).not.toMatch(/use client/);
      expect(src).not.toMatch(/onSubmit|saveProvider|\.update\s*\(/);
      expect(src).toContain("provider-menu-profile-diagnostic-legacy");
      expect(src).toContain("uiVsProfileExplanation");
    });
  });
});

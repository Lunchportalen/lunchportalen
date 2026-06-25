import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LP_MENU_PROFILE_RESOLVER_ENV } from "@/lib/menu-profile";
import {
  buildProviderMenuProfileDiagnostic,
  type ProviderMenuProfileDiagnostic,
} from "@/lib/providers/providerMenuProfileDiagnostic";
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
    });
  });
});

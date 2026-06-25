import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { providerSettingsRowToMenuProfileInput } from "@/lib/providers/loadProviderSettingsMenuProfile";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const LOADER = path.join(ROOT, "lib/providers/loadProviderSettingsMenuProfile.ts");

describe("loadProviderSettingsMenuProfile (ADR-019 G3 read-only)", () => {
  const sql = readFileSync(LOADER, "utf8");

  it("selects menu_profile_id and market fields from provider_settings", () => {
    expect(sql).toContain("menu_profile_id");
    expect(sql).toContain("default_country_code");
    expect(sql).toContain("locale");
    expect(sql).not.toMatch(/\.update\s*\(/);
    expect(sql).not.toMatch(/\.insert\s*\(/);
  });

  it("does not expose resolved profile to UI types", () => {
    expect(sql).not.toMatch(/ProviderOperationalSettings/);
    expect(sql).not.toMatch(/leverandor/);
  });

  it("maps row to pure resolver input", () => {
    const input = providerSettingsRowToMenuProfileInput({
      providerId: "11111111-1111-1111-1111-111111111111",
      menuProfileId: "italian_office_lunch",
      defaultCountryCode: "IT",
      locale: "it-IT",
      defaultCurrency: "EUR",
    });
    expect(input.menuProfileId).toBe("italian_office_lunch");
    expect(input.defaultCountryCode).toBe("IT");
    expect(input.providerId).toBe("11111111-1111-1111-1111-111111111111");
  });
});

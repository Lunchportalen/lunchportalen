import { describe, expect, it } from "vitest";

import { LP_MENU_PROFILE_RESOLVER_ENV } from "@/lib/menu-profile/featureFlag";
import { MENU_PROFILE_IDS } from "@/lib/menu-profile/types";
import {
  buildProviderMenuProfileHealthFromSettingsRow,
  buildSuperadminMenuProfileRegistryRows,
  detectLocaleMenuProfileMismatch,
  toSuperadminMenuProfileOverviewRow,
} from "@/lib/superadmin/menuProfileControl";

const ENV_ON = { [LP_MENU_PROFILE_RESOLVER_ENV]: "true" };

describe("menuProfileControl — registry", () => {
  it("exposes all 9 menu profiles", () => {
    const rows = buildSuperadminMenuProfileRegistryRows();
    expect(rows).toHaveLength(9);
    expect(rows.map((row) => row.profileId).sort()).toEqual([...MENU_PROFILE_IDS].sort());
    for (const row of rows) {
      expect(row.warmDishBankCount).toBeGreaterThanOrEqual(5);
      expect(row.categoryLabelCoverage.total).toBe(6);
    }
  });
});

describe("menuProfileControl — provider health resolver", () => {
  it("marks profile resolved OK when resolver ON and profile configured", () => {
    const health = buildProviderMenuProfileHealthFromSettingsRow(
      {
        providerId: "00000000-0000-4000-8000-000000000001",
        menuProfileId: "norwegian_company_lunch",
        defaultCountryCode: "NO",
        locale: "nb-NO",
        defaultCurrency: "NOK",
      },
      ENV_ON,
    );

    expect(health.profileResolved).toBe("OK");
    expect(health.generationEnabled).toBe(true);
    expect(health.warmDishBankCount).toBeGreaterThanOrEqual(5);
  });

  it("marks profile resolved FAIL when resolver OFF", () => {
    const health = buildProviderMenuProfileHealthFromSettingsRow(
      {
        providerId: "00000000-0000-4000-8000-000000000001",
        menuProfileId: "norwegian_company_lunch",
        defaultCountryCode: "NO",
        locale: "nb-NO",
        defaultCurrency: "NOK",
      },
      {},
    );

    expect(health.profileResolved).toBe("FAIL");
    expect(health.generationEnabled).toBe(false);
    expect(health.readiness).toBe("legacy");
  });
});

describe("menuProfileControl — mismatch warning", () => {
  it("detects locale/profile mismatch", () => {
    const mismatch = detectLocaleMenuProfileMismatch({
      providerId: "00000000-0000-4000-8000-000000000001",
      menuProfileId: "swedish_lunch",
      defaultCountryCode: "NO",
      locale: "nb-NO",
      defaultCurrency: "NOK",
    });

    expect(mismatch.mismatch).toBe(true);
    expect(mismatch.detail).toMatch(/swedish_lunch|norwegian_company_lunch/);
  });

  it("surfaces mismatch in overview row", () => {
    const health = buildProviderMenuProfileHealthFromSettingsRow(
      {
        providerId: "00000000-0000-4000-8000-000000000001",
        menuProfileId: "swedish_lunch",
        defaultCountryCode: "NO",
        locale: "nb-NO",
        defaultCurrency: "NOK",
      },
      ENV_ON,
    );

    const row = toSuperadminMenuProfileOverviewRow("00000000-0000-4000-8000-000000000001", "Test AS", health);
    expect(row.mismatch).toBe(true);
    expect(row.readiness).toBe("warning");
  });
});

describe("menuProfileControl — fallback warning", () => {
  it("marks fallback active when profile resolves via market default", () => {
    const health = buildProviderMenuProfileHealthFromSettingsRow(
      {
        providerId: "00000000-0000-4000-8000-000000000001",
        menuProfileId: null,
        defaultCountryCode: "NO",
        locale: "nb-NO",
        defaultCurrency: "NOK",
      },
      ENV_ON,
    );

    expect(health.profileResolved).toBe("OK");
    expect(health.fallbackActive).toBe(true);
  });
});

describe("menuProfileControl — employee exposure", () => {
  it("superadmin control layer does not expose commercial fields or order write-path", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const files = [
      "lib/superadmin/menuProfileControl.ts",
      "lib/server/superadmin/loadSuperadminMenuProfileOverview.ts",
      "app/superadmin/menu-profiles/MenuProfilesClient.tsx",
    ];
    for (const rel of files) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      expect(src).not.toMatch(/lp_order_set/);
      expect(src).not.toMatch(/unitPrice|marginPercent|commercialVisible/);
    }
  });
});

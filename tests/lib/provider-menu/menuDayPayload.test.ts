import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { MELHUS_PROVIDER_SANITY_ID } from "@/lib/cms/providerSanityConstants";
import { fallbackProviderMenuPrices } from "@/lib/providers/providerMenuPriceConfig";
import {
  buildMenuDayDocId,
  buildMenuDayPayload,
  parseMenuDayRequestBody,
} from "@/lib/provider-menu/menuDayPayload";

const PROVIDER_B = "22222222-2222-2222-2222-222222222222";

const validInput = {
  date: "2026-06-16",
  tier: "BASIS",
  category: "varmrett",
  mealTitle: "Kyllinggryte",
  description: "Med rotgrønnsaker og potetmos.",
  allergensText: "melk, hvete",
  status: "draft" as const,
};

describe("buildMenuDayDocId", () => {
  test("includes providerId/date/tier/category for non-Melhus providers", () => {
    expect(buildMenuDayDocId(PROVIDER_B, "2026-06-16", "BASIS", "varmrett")).toBe(
      `menuDay-${PROVIDER_B}-2026-06-16-BASIS-varmrett`,
    );
  });

  test("Melhus retains legacy id without provider segment", () => {
    expect(buildMenuDayDocId(MELHUS_PROVIDER_SANITY_ID, "2026-06-16", "BASIS", "varmrett")).toBe(
      "menuDay-2026-06-16-BASIS-varmrett",
    );
  });
});

describe("buildMenuDayPayload", () => {
  test("draft sets approvedForPublish=false and customerVisible=false", () => {
    const res = buildMenuDayPayload(PROVIDER_B, validInput);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload.approvedForPublish).toBe(false);
    expect(res.payload.customerVisible).toBe(false);
    expect(res.payload.approvedAt).toBeUndefined();
    expect(res.payload.customerVisibleSetAt).toBeUndefined();
  });

  test("published sets approvedForPublish=true and customerVisible=true", () => {
    const res = buildMenuDayPayload(PROVIDER_B, { ...validInput, status: "published" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload.approvedForPublish).toBe(true);
    expect(res.payload.customerVisible).toBe(true);
    expect(res.payload.approvedAt).toBeTruthy();
    expect(res.payload.customerVisibleSetAt).toBeTruthy();
  });

  test("uses server-resolved providerId in payload", () => {
    const res = buildMenuDayPayload(PROVIDER_B, validInput);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload.provider).toEqual({ _type: "reference", _ref: PROVIDER_B });
    expect(res.docId).toBe(`menuDay-${PROVIDER_B}-2026-06-16-BASIS-varmrett`);
  });

  test("parses allergensText into allergens array", () => {
    const res = buildMenuDayPayload(PROVIDER_B, validInput);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload.allergens).toEqual(["melk", "hvete"]);
  });

  test("rejects invalid tier", () => {
    const res = buildMenuDayPayload(PROVIDER_B, { ...validInput, tier: "GULL" });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.field).toBe("tier");
  });

  test("rejects invalid category", () => {
    const res = buildMenuDayPayload(PROVIDER_B, { ...validInput, category: "INVALID_CAT" });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.field).toBe("category");
  });

  test("canonicalizes varmmat alias to varmrett", () => {
    const res = buildMenuDayPayload(PROVIDER_B, { ...validInput, category: "varmmat" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload.category).toBe("varmrett");
  });

  test("rejects category not allowed for tier", () => {
    const res = buildMenuDayPayload(PROVIDER_B, { ...validInput, tier: "BASIS", category: "sushi" });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.field).toBe("category");
  });

  test("draft allows incomplete mealTitle and description", () => {
    const res = buildMenuDayPayload(PROVIDER_B, {
      ...validInput,
      mealTitle: "",
      description: "",
      status: "draft",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.payload.mealTitle).toBe("Utkast");
    expect(res.payload.approvedForPublish).toBe(false);
  });

  test("published requires mealTitle and description", () => {
    const res = buildMenuDayPayload(PROVIDER_B, { ...validInput, mealTitle: "", status: "published" });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.field).toBe("mealTitle");
  });

  test("Enterprise publish requires upgrade when sourcePackage set", () => {
    const res = buildMenuDayPayload(PROVIDER_B, {
      ...validInput,
      tier: "ENTERPRISE",
      category: "varmrett",
      status: "published",
      sourcePackage: "LUXUS",
      upgradeNote: "",
      upgradeType: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.field).toBe("upgradeNote");
  });

  test("Enterprise publish accepts upgrade note", () => {
    const res = buildMenuDayPayload(PROVIDER_B, {
      ...validInput,
      tier: "ENTERPRISE",
      category: "varmrett",
      status: "published",
      sourcePackage: "LUXUS",
      upgradeNote: "Inkluderer dessert og større porsjon",
      upgradeType: "DESSERT_FRUIT",
    });
    expect(res.ok).toBe(true);
  });

  test("Enterprise soft warning requires confirmWarnings to publish", () => {
    const res = buildMenuDayPayload(PROVIDER_B, {
      ...validInput,
      tier: "ENTERPRISE",
      category: "varmrett",
      status: "published",
      mealTitle: "Premium rett",
      description: "Uten upgrade-felt",
      sourcePackage: null,
      upgradeNote: "",
      upgradeType: null,
    });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.field).toBe("confirmWarnings");
  });

  test("Enterprise publish succeeds with confirmWarnings", () => {
    const res = buildMenuDayPayload(PROVIDER_B, {
      ...validInput,
      tier: "ENTERPRISE",
      category: "varmrett",
      status: "published",
      mealTitle: "Premium rett",
      description: "Uten upgrade-felt men bekreftet",
      sourcePackage: null,
      upgradeNote: "",
      upgradeType: null,
      confirmWarnings: true,
    });
    expect(res.ok).toBe(true);
  });

  test("rejects empty overwrite of existing published item", () => {
    const res = buildMenuDayPayload(
      PROVIDER_B,
      {
        ...validInput,
        mealTitle: "",
        description: "",
        status: "published",
      },
      {
        existingSlot: {
          id: "menuDay-existing",
          date: "2026-06-16",
          tier: "BASIS",
          category: "varmrett",
          mealTitle: "Eksisterende gryte",
          description: "Med potet",
          allergens: [],
          estimatedCostPerPortion: null,
          sourcePackage: null,
          upgradeType: null,
          upgradeNote: null,
          approvedForPublish: true,
          customerVisible: true,
          status: "published",
        },
      },
    );
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.field).toBe("mealTitle");
  });

  test("rejects invalid date", () => {
    const res = buildMenuDayPayload(PROVIDER_B, { ...validInput, date: "16-06-2026" });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.field).toBe("date");
  });

  test("rejects empty providerId", () => {
    const res = buildMenuDayPayload("", validInput);
    expect(res.ok).toBe(false);
  });
});

describe("R4F: menuDayPayload price truth contract", () => {
  test("server publish path uses fallbackProviderMenuPrices not loadProviderMenuPrices", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/provider-menu/menuDayPayload.ts"), "utf8");
    expect(src).toContain("fallbackProviderMenuPrices()");
    expect(src).not.toContain("loadProviderMenuPrices");
    expect(src).not.toContain("pricePreview");
    expect(src).not.toContain("loadProviderMenuPricesPreview");
  });

  test("enterprise publish validation uses tier fallback price not DB resolver", () => {
    const fallback = fallbackProviderMenuPrices();
    expect(fallback.ENTERPRISE.priceExVatNok).toBe(170);

    const res = buildMenuDayPayload(PROVIDER_B, {
      ...validInput,
      tier: "ENTERPRISE",
      category: "varmrett",
      status: "published",
      mealTitle: "Premium rett",
      description: "Høy kost — valideres mot fallback 170 ikke DB",
      sourcePackage: null,
      upgradeNote: "",
      upgradeType: null,
      estimatedCostPerPortion: 165,
      luxusEstimatedCost: 120,
      confirmWarnings: false,
    });

    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.field).toBe("confirmWarnings");
    }
  });
});

describe("parseMenuDayRequestBody", () => {
  test("parses valid body without providerId", () => {
    const parsed = parseMenuDayRequestBody({
      date: "2026-06-16",
      tier: "BASIS",
      category: "varmrett",
      mealTitle: "Test",
      description: "Beskrivelse",
      allergensText: "melk",
      status: "draft",
    });
    expect(parsed).toEqual({
      date: "2026-06-16",
      tier: "BASIS",
      category: "varmrett",
      mealTitle: "Test",
      description: "Beskrivelse",
      allergensText: "melk",
      status: "draft",
      estimatedCostPerPortion: null,
      sourcePackage: null,
      upgradeType: null,
      upgradeNote: null,
      confirmWarnings: false,
      luxusEstimatedCost: null,
    });
  });

  test("ignores client providerId (not part of parsed shape)", () => {
    const parsed = parseMenuDayRequestBody({
      providerId: "evil-provider-id",
      date: "2026-06-16",
      tier: "BASIS",
      category: "varmrett",
      mealTitle: "Test",
      description: "Beskrivelse",
      status: "published",
    });
    expect(parsed).not.toBeNull();
    expect(parsed && "providerId" in parsed).toBe(false);
  });
});

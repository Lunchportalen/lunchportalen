import { describe, expect, test } from "vitest";

import { MELHUS_PROVIDER_SANITY_ID } from "@/lib/cms/providerSanityConstants";
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
    const res = buildMenuDayPayload(PROVIDER_B, { ...validInput, category: "varmmat" });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.field).toBe("category");
  });

  test("rejects category not allowed for tier", () => {
    const res = buildMenuDayPayload(PROVIDER_B, { ...validInput, tier: "BASIS", category: "sushi" });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.field).toBe("category");
  });

  test("rejects missing mealTitle", () => {
    const res = buildMenuDayPayload(PROVIDER_B, { ...validInput, mealTitle: "" });
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

import { describe, expect, it } from "vitest";

import {
  mergeLunchCategoryRowsWithTemplateFallback,
  providerLunchCategoryDocId,
  categoryTiersForEditableKey,
  isEditableLunchCategoryKey,
} from "@/lib/cms/lunchCategory";

describe("lunchCategory provider scope merge", () => {
  const templates = [
    {
      key: "paasmurt",
      title: "Påsmurt",
      allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
      items: [{ key: "ost-skinke", title: "Ost & Skinke", allergens: ["melk"] }],
    },
    {
      key: "sushi",
      title: "Sushi",
      allowedPlanTiers: ["LUXUS", "ENTERPRISE"],
      items: [{ key: "sushi-pakke", title: "Mal sushi" }],
    },
    {
      key: "varmrett",
      title: "Varmrett",
      allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
      items: [],
    },
  ];

  it("unedited provider sees template rows", () => {
    const merged = mergeLunchCategoryRowsWithTemplateFallback(templates, []);
    expect(merged.find((r) => r.key === "paasmurt")?.items).toEqual(templates[0].items);
  });

  it("provider row overrides template for same key", () => {
    const providerRows = [
      {
        key: "paasmurt",
        title: "Påsmurt",
        allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
        items: [{ key: "custom", title: "Leverandør valg" }],
      },
    ];
    const merged = mergeLunchCategoryRowsWithTemplateFallback(templates, providerRows);
    const paasmurt = merged.find((r) => r.key === "paasmurt");
    expect(paasmurt?.items).toEqual(providerRows[0].items);
    expect(merged.find((r) => r.key === "sushi")?.items).toEqual(templates[1].items);
  });

  it("varmrett always from template even if provider doc exists", () => {
    const providerRows = [
      {
        key: "varmrett",
        title: "Hack",
        items: [{ key: "evil", title: "Evil" }],
      },
    ];
    const merged = mergeLunchCategoryRowsWithTemplateFallback(templates, providerRows);
    expect(merged.find((r) => r.key === "varmrett")?.title).toBe("Varmrett");
    expect(merged.find((r) => r.key === "varmrett")?.items).toEqual([]);
  });

  it("deterministic provider doc id", () => {
    expect(providerLunchCategoryDocId("aaa-bbb", "paasmurt")).toBe("lunchCategory-aaa-bbb-paasmurt");
  });

  it("category tier policy", () => {
    expect(categoryTiersForEditableKey("paasmurt")).toEqual(["BASIS", "LUXUS", "ENTERPRISE"]);
    expect(categoryTiersForEditableKey("sushi")).toEqual(["LUXUS", "ENTERPRISE"]);
    expect(isEditableLunchCategoryKey("varmrett")).toBe(false);
  });
});

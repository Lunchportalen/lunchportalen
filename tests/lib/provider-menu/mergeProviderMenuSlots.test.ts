import { describe, expect, it } from "vitest";

import type { ProviderMenuDayRow } from "@/lib/provider-menu/loadProviderMenuDays";
import {
  mergeProviderMenuRowsIntoSlots,
  resolveProviderMenuSlot,
  slotDisplayStatus,
  slotDisplayTitle,
} from "@/lib/provider-menu/mergeProviderMenuSlots";

function row(partial: Partial<ProviderMenuDayRow> & Pick<ProviderMenuDayRow, "category" | "mealTitle">): ProviderMenuDayRow {
  return {
    id: `menuDay-${partial.date ?? "2026-06-16"}-${partial.tier ?? "LUXUS"}-${partial.category}`,
    date: partial.date ?? "2026-06-16",
    tier: partial.tier ?? "LUXUS",
    category: partial.category as ProviderMenuDayRow["category"],
    mealTitle: partial.mealTitle,
    description: partial.description ?? "Beskrivelse",
    allergens: partial.allergens ?? [],
    estimatedCostPerPortion: partial.estimatedCostPerPortion ?? null,
    sourcePackage: partial.sourcePackage ?? null,
    upgradeType: partial.upgradeType ?? null,
    upgradeNote: partial.upgradeNote ?? null,
    approvedForPublish: partial.approvedForPublish ?? false,
    customerVisible: partial.customerVisible ?? false,
    status: partial.status ?? "draft",
  };
}

describe("mergeProviderMenuRowsIntoSlots", () => {
  it("maps legacy salatboks alias into salat slot", () => {
    const merged = mergeProviderMenuRowsIntoSlots([
      {
        ...row({ category: "salat", mealTitle: "Kyllingsalat" }),
        category: "salatboks" as ProviderMenuDayRow["category"],
      },
    ]);
    const slot = resolveProviderMenuSlot(merged, "2026-06-16", "LUXUS", "salat");
    expect(slotDisplayTitle(slot)).toBe("Kyllingsalat");
  });

  it.each([
    ["paasmurt", "Smørbrøt"],
    ["salat", "Kyllingsalat"],
    ["sushi", "Maki mix"],
    ["pokebowl", "Laks poke"],
    ["thai", "Pad Thai"],
    ["varmrett", "Kyllinggryte"],
  ])("existing published %s renders, not Tom", (category, title) => {
    const merged = mergeProviderMenuRowsIntoSlots([
      row({
        category: category as ProviderMenuDayRow["category"],
        mealTitle: title,
        status: "published",
        approvedForPublish: true,
        customerVisible: true,
      }),
    ]);
    const slot = resolveProviderMenuSlot(merged, "2026-06-16", "LUXUS", category as "paasmurt" | "salat" | "sushi" | "pokebowl" | "thai" | "varmrett");
    expect(slotDisplayTitle(slot)).toBe(title);
    expect(slotDisplayStatus(slot)).not.toBe("Tom");
  });

  it("Tom renders only when no source data exists", () => {
    const merged = mergeProviderMenuRowsIntoSlots([]);
    const slot = resolveProviderMenuSlot(merged, "2026-06-16", "LUXUS", "sushi");
    expect(slotDisplayStatus(slot)).toBe("Tom");
    expect(slotDisplayTitle(slot)).toBe("—");
  });

  it("published wins over draft for same slot", () => {
    const merged = mergeProviderMenuRowsIntoSlots([
      row({ category: "paasmurt", mealTitle: "Draft rett", status: "draft" }),
      row({
        category: "paasmurt",
        mealTitle: "Publisert rett",
        status: "published",
        approvedForPublish: true,
        customerVisible: true,
      }),
    ]);
    const slot = resolveProviderMenuSlot(merged, "2026-06-16", "LUXUS", "paasmurt");
    expect(slot.mealTitle).toBe("Publisert rett");
    expect(slot.status).toBe("published");
  });
});

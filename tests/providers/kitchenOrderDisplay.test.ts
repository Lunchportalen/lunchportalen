import { describe, expect, test } from "vitest";

import {
  buildKitchenOrderItemDisplay,
  formatProviderOrderItemLine,
  profileDisplayName,
  profileEmail,
  resolveVariantTitleFromLookup,
} from "@/lib/providers/kitchenOrderDisplay";

describe("kitchenOrderDisplay", () => {
  test("formats category and variant with middle dot", () => {
    expect(
      formatProviderOrderItemLine({
        choiceLabel: "Påsmurt",
        variantTitle: "Laks & Eggerøre",
      }),
    ).toBe("Påsmurt · Laks & Eggerøre");
  });

  test("prefers variant title over raw item_key when snapshot exists", () => {
    const item = buildKitchenOrderItemDisplay({
      productNameSnapshot: "Paasmurt",
      quantity: 1,
      choice: {
        choiceKey: "paasmurt",
        itemKey: "laks-eggerore",
        itemTitleSnapshot: "Laks & Eggerøre",
      },
    });
    expect(item.displayLine).toBe("Påsmurt · Laks & Eggerøre");
    expect(item.displayLine).not.toContain("laks-eggerore");
  });

  test("resolves variant from lookup when snapshot is missing", () => {
    const lookup = new Map<string, string>([["paasmurt:laks-eggerore", "Laks & Eggerøre"]]);
    expect(resolveVariantTitleFromLookup("paasmurt", "laks-eggerore", lookup)).toBe("Laks & Eggerøre");

    const item = buildKitchenOrderItemDisplay({
      productNameSnapshot: "Paasmurt",
      quantity: 1,
      choice: { choiceKey: "paasmurt", itemKey: "laks-eggerore", itemTitleSnapshot: null },
      variantLookup: lookup,
    });
    expect(item.displayLine).toBe("Påsmurt · Laks & Eggerøre");
  });

  test("falls back to product snapshot when variant is unavailable", () => {
    const item = buildKitchenOrderItemDisplay({
      productNameSnapshot: "Paasmurt",
      quantity: 1,
      choice: { choiceKey: "paasmurt", itemKey: null, itemTitleSnapshot: null },
    });
    expect(item.displayLine).toBe("Påsmurt");
  });

  test("profile display prefers full name then email local-part", () => {
    expect(profileDisplayName({ full_name: "Thomas Johansen", email: "thomas@pettersenco.no" })).toBe(
      "Thomas Johansen",
    );
    expect(profileEmail({ email: "thomas@pettersenco.no" })).toBe("thomas@pettersenco.no");
  });

  test("returns null profile and product fallbacks for UI i18n resolution", () => {
    expect(profileDisplayName({ full_name: null, email: null })).toBeNull();
    expect(profileDisplayName(null)).toBeNull();
    expect(formatProviderOrderItemLine({})).toBeNull();
    expect(formatProviderOrderItemLine({ choiceLabel: null, variantTitle: null, productNameSnapshot: null })).toBeNull();

    const item = buildKitchenOrderItemDisplay({
      productNameSnapshot: null,
      quantity: 1,
      choice: null,
    });
    expect(item.displayLine).toBeNull();
    expect(item.productName).toBe("");
  });
});

describe("loadKitchenOrders enrichment guard", () => {
  test("loader keeps provider scope then admin enrichment for scoped order IDs", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "lib/providers/loadKitchenOrders.ts"), "utf-8");
    const enrichment = readFileSync(join(process.cwd(), "lib/providers/providerOrderEnrichment.ts"), "utf-8");
    expect(source).toContain('.select("id, date, slot, status, note, company_id, location_id, user_id")');
    expect(source).toContain("fetchProviderOrderEnrichment");
    expect(source).toContain(".eq(\"provider_id\", pid)");
    expect(enrichment).toContain('from("profiles")');
    expect(enrichment).toContain('from("day_choices")');
    expect(enrichment).toContain('from("company_locations")');
    expect(enrichment).toContain('from("order_items")');
    expect(enrichment).toContain("supabaseAdmin");
    expect(source).not.toContain("lp_order_set");
  });

  test("kitchen order card renders enriched employee and item line", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "components/providers/KitchenOrderCard.tsx"), "utf-8");
    expect(source).toContain("employeeDisplayName");
    expect(source).toContain("employeeEmail");
    expect(source).toContain("displayLine");
    expect(source).toContain("provider.orders.fallbacks");
    expect(source).not.toContain("item_key");
  });
});
